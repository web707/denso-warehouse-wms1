import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '@/api';
import { useAuth } from '@/lib/AuthContext';

const StoreContext = createContext(null);

function toParts(rawParts) {
  return rawParts.map((p) => ({
    id: p.id,
    orderId: p.orderId,
    partName: p.partName,
    productCode: p.productCode || '',
    masterPo: p.masterPo,
    dcPrefix: p.dcPrefix?.code || '',
    poNumber: '',
    divisionCode: p.division?.code || '',
    quantity: p.quantityPcs,
    weight: Number(p.totalWeightKg),
    cartons: p.cartonCount,
    cartonLength: p.cartonLengthMm / 10,
    cartonWidth: p.cartonWidthMm / 10,
    cartonHeight: p.cartonHeightMm / 10,
    rackId: p.rackId,
    preferredRackSlot: p.preferredRackSlot,
    color: p.colorHex,
  }));
}

function toRacks(rawRacks) {
  return rawRacks.map((r) => ({
    id: r.id,
    orderId: r.orderId,
    name: r.name,
    warehouseCode: r.warehouseCode || 'DENSO-WH',
    zoneCode: r.zoneCode || 'ZONE-A',
    type: r.rackType?.code,
    rackTypeId: r.rackType?.id,
    maxCbm: Number(r.maxCbmOverride ?? r.rackType?.maxCbm ?? 0),
    maxWeight: Number(r.maxPayloadKgOverride ?? r.rackType?.maxPayloadKg ?? 0),
  }));
}

function toRules(rawRules) {
  return rawRules.map((r) => ({
    id: r.id,
    icon: r.icon,
    text: r.text,
    category: r.category,
    active: r.active,
    isSystem: r.isSystem,
  }));
}

export function StoreProvider({ children }) {
  const [orders, setOrders] = useState([]);
  const [parts, setParts] = useState([]);
  const [racks, setRacks] = useState([]);
  const [packingRules, setPackingRules] = useState([]);
  const [history, setHistory] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [rackTypes, setRackTypes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentOrderId, setCurrentOrderIdState] = useState(() => localStorage.getItem('currentOrderId') || null);

  const setCurrentOrderId = useCallback((id) => {
    setCurrentOrderIdState(id);
    if (id) localStorage.setItem('currentOrderId', id);
    else localStorage.removeItem('currentOrderId');
  }, []);

  const refetchOrders = useCallback(() => api.orders.list().then(setOrders), []);
  const refetchParts = useCallback(() => api.parts.list().then((d) => setParts(toParts(d))), []);
  const refetchRacks = useCallback(() => api.racks.list().then((d) => setRacks(toRacks(d))), []);
  const refetchRules = useCallback(() => api.packingRules.list().then((d) => setPackingRules(toRules(d))), []);
  const refetchHistory = useCallback(() => api.history.list({ pageSize: 200 }).then((res) => setHistory(res.items)), []);

  const { isAuthenticated, isBootstrapping } = useAuth();

  useEffect(() => {
    if (isBootstrapping || !isAuthenticated) return;
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const [divs, types] = await Promise.all([api.divisions.list(), api.rackTypes.list()]);
        if (cancelled) return;
        setDivisions(divs);
        setRackTypes(types);
        await Promise.all([refetchOrders(), refetchParts(), refetchRacks(), refetchRules(), refetchHistory()]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, isBootstrapping, refetchOrders, refetchParts, refetchRacks, refetchRules, refetchHistory]);

  function resolveDivisionAndPrefix(divisionCode, dcPrefixCode) {
    const division = divisions.find((d) => d.code === String(divisionCode || '').trim().toUpperCase());
    if (!division) throw new Error(`Division "${divisionCode}" không tồn tại`);
    const wantedPrefix = String(dcPrefixCode || '').trim().padStart(2, '0');
    const prefix = (division.dcPrefixes || []).find((p) => p.code === wantedPrefix);
    if (!prefix) throw new Error(`DC Prefix "${dcPrefixCode}" không thuộc Division "${divisionCode}"`);
    return { divisionId: division.id, dcPrefixId: prefix.id };
  }

  const addOrder = useCallback(async (data) => {
    const order = await api.orders.create({
      orderNumber: data.orderNumber,
      name: data.name || undefined,
      division: data.division,
      destination: data.destination || 'WAREHOUSE',
    });
    await Promise.all([refetchOrders(), refetchHistory()]);
    return order;
  }, [refetchOrders, refetchHistory]);

  const updateOrder = useCallback(async (id, data) => {
    await api.orders.update(id, data);
    await Promise.all([refetchOrders(), refetchHistory()]);
  }, [refetchOrders, refetchHistory]);

  const renameOrder = useCallback((id, name) => updateOrder(id, { name }), [updateOrder]);

  const deleteOrder = useCallback(async (id) => {
    await api.orders.remove(id);
    await Promise.all([refetchOrders(), refetchParts(), refetchRacks(), refetchHistory()]);
  }, [refetchOrders, refetchParts, refetchRacks, refetchHistory]);

  function toCreatePartBody(data) {
    const { divisionId, dcPrefixId } = resolveDivisionAndPrefix(data.divisionCode, data.dcPrefix);
    return {
      orderId: data.orderId,
      partName: data.partName,
      productCode: data.productCode || undefined,
      divisionId,
      dcPrefixId,
      masterPo: data.masterPo,
      quantityPcs: +data.quantity || 0,
      totalWeightKg: +data.weight || 0,
      cartonCount: +data.cartons || 0,
      cartonLengthMm: Math.round((+data.cartonLength || 0) * 10),
      cartonWidthMm: Math.round((+data.cartonWidth || 0) * 10),
      cartonHeightMm: Math.round((+data.cartonHeight || 0) * 10),
    };
  }

  const addPart = useCallback(async (data) => {
    const created = await api.parts.create(toCreatePartBody(data));
    await Promise.all([refetchParts(), refetchHistory()]);
    return created;
  }, [divisions, refetchParts, refetchHistory]); // eslint-disable-line react-hooks/exhaustive-deps

  const resolveRacks = useCallback(async (rackIds) => {
    const ids = [...new Set(rackIds.filter(Boolean))];
    await Promise.all(ids.map((id) => api.storage.solve(id).catch(() => {})));
  }, []);

  const updatePart = useCallback(async (id, data) => {
    const previous = parts.find((p) => p.id === id);
    await api.parts.update(id, toCreatePartBody(data));
    await resolveRacks([previous?.rackId, data.rackId]);
    await Promise.all([refetchParts(), refetchRacks(), refetchHistory()]);
  }, [divisions, parts, resolveRacks, refetchParts, refetchRacks, refetchHistory]); // eslint-disable-line react-hooks/exhaustive-deps

  const deletePart = useCallback(async (id) => {
    const previous = parts.find((p) => p.id === id);
    await api.parts.remove(id);
    await resolveRacks([previous?.rackId]);
    await Promise.all([refetchParts(), refetchRacks(), refetchHistory()]);
  }, [parts, resolveRacks, refetchParts, refetchRacks, refetchHistory]);

  const assignPart = useCallback(async (partId, rackId, slotIndex = null) => {
    const previous = parts.find((p) => p.id === partId);
    await api.parts.assignRack(partId, rackId || null, slotIndex);
    await resolveRacks([previous?.rackId, rackId]);
    await Promise.all([refetchParts(), refetchRacks(), refetchHistory()]);
  }, [parts, resolveRacks, refetchParts, refetchRacks, refetchHistory]);

  const createRackForOrder = useCallback(async (orderId, { rackTypeId, name, warehouseCode, zoneCode, maxCbm, maxWeight }) => {
    const rack = await api.racks.create({
      orderId,
      rackTypeId,
      name,
      warehouseCode: warehouseCode || 'DENSO-WH',
      zoneCode: zoneCode || 'ZONE-A',
      maxCbmOverride: maxCbm || undefined,
      maxPayloadKgOverride: maxWeight || undefined,
    });
    await Promise.all([refetchRacks(), refetchHistory()]);
    return rack;
  }, [refetchRacks, refetchHistory]);

  const initializeWarehouse = useCallback(async ({ orderId, warehouseCode = 'DENSO-WH', zoneCode = 'ZONE-A', rackCount = 20, rackTypeId }) => {
    const result = await api.racks.initializeWarehouse({
      orderId,
      warehouseCode,
      zoneCode,
      rackCount,
      rackTypeId,
    });
    await Promise.all([refetchRacks(), refetchHistory()]);
    return result;
  }, [refetchRacks, refetchHistory]);

  const autoAssignRack = useCallback(async (rackId) => {
    const assignResult = await api.storage.autoAssign(rackId);
    const plan = await api.storage.solve(rackId);
    await Promise.all([refetchParts(), refetchRacks(), refetchOrders(), refetchHistory()]);
    return { ...assignResult, violations: plan.violations };
  }, [refetchParts, refetchRacks, refetchOrders, refetchHistory]);

  const updateRack = useCallback(async (id, data) => {
    await api.racks.update(id, {
      name: data.name,
      rackTypeId: data.rackTypeId,
      warehouseCode: data.warehouseCode,
      zoneCode: data.zoneCode,
      maxCbmOverride: data.maxCbm,
      maxPayloadKgOverride: data.maxWeight,
    });
    await Promise.all([refetchRacks(), refetchHistory()]);
  }, [refetchRacks, refetchHistory]);

  const deleteRack = useCallback(async (id) => {
    await api.racks.remove(id);
    await Promise.all([refetchRacks(), refetchParts(), refetchHistory()]);
  }, [refetchRacks, refetchParts, refetchHistory]);

  const addRule = useCallback(async (data) => {
    await api.packingRules.create(data);
    await Promise.all([refetchRules(), refetchHistory()]);
  }, [refetchRules, refetchHistory]);
  const updateRule = useCallback(async (id, data) => { await api.packingRules.update(id, data); await refetchRules(); }, [refetchRules]);
  const deleteRule = useCallback(async (id) => { await api.packingRules.remove(id); await Promise.all([refetchRules(), refetchHistory()]); }, [refetchRules, refetchHistory]);
  const activeRules = packingRules.filter((r) => r.active !== false);
  const logExport = useCallback(() => { refetchHistory(); }, [refetchHistory]);
  const resetData = useCallback(async () => {
    await Promise.all([refetchOrders(), refetchParts(), refetchRacks(), refetchRules(), refetchHistory()]);
  }, [refetchOrders, refetchParts, refetchRacks, refetchRules, refetchHistory]);

  const value = {
    orders, parts, racks, packingRules, history, rackTypes, divisions, activeRules, isLoading,
    currentOrderId, setCurrentOrderId,
    addOrder, updateOrder, renameOrder, deleteOrder,
    addPart, updatePart, deletePart, assignPart,
    createRackForOrder, initializeWarehouse, autoAssignRack, updateRack, deleteRack,
    addRule, updateRule, deleteRule, logExport, resetData,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
