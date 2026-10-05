export interface SolverConfig {
  // 'front': the first item in loading order (Division/DcPrefix/MasterPo
  // ascending) sits at x=0, the wall furthest from the door — matches the
  // client's "Front -> Door" / "load from inside out" requirement.
  // 'door': mirrors the layout so the first item sits nearest the door.
  sequenceOrigin: 'front' | 'door';
  // 'adjacent' (default): when a PART's cartons don't fill a whole wall,
  // the NEXT part in sort order continues filling that same wall's
  // leftover cells (only once its carton dimensions match exactly — the
  // grid must still line up) before opening a wall of its own. This is
  // the client's "một carton wall chỉ được chứa nhiều DC Prefix khi là
  // phần tiếp nối của DC Prefix ở wall trước" rule — cells still fill in
  // strict sort order, just without wasting the leftover headroom.
  // 'off': always open a brand-new wall instead — a PART's cartons are
  // never placed alongside a different PART, at the cost of wasted space.
  spillOverPolicy: 'off' | 'adjacent';
}

export const DEFAULT_SOLVER_CONFIG: SolverConfig = {
  sequenceOrigin: 'front',
  spillOverPolicy: 'adjacent',
};
