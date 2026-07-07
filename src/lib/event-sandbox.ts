export type EventTestFilter = "all" | "production" | "test";

export function matchesEventTestFilter(
  event: { is_test?: boolean },
  filter: EventTestFilter,
) {
  if (filter === "all") {
    return true;
  }

  return filter === "test" ? Boolean(event.is_test) : !event.is_test;
}

export function countProductionEventsByOrganization(
  events: Array<{ organization_id: string; is_test?: boolean }>,
) {
  return events.reduce<Record<string, number>>((counts, event) => {
    if (event.is_test) {
      return counts;
    }

    counts[event.organization_id] = (counts[event.organization_id] ?? 0) + 1;
    return counts;
  }, {});
}
