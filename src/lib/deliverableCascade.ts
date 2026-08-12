import { Deliverable, DeliverableSegment } from '../types';

export interface DeliverableCascadeState {
  deliverables: Deliverable[];
  deliverableSegments: DeliverableSegment[];
}

export function removeDeliverableAndSegments(
  data: DeliverableCascadeState,
  deliverableId: string,
): DeliverableCascadeState {
  return {
    deliverables: data.deliverables.filter((app) => app.id !== deliverableId),
    deliverableSegments: data.deliverableSegments.filter((segment) => segment.deliverableId !== deliverableId),
  };
}

export function clearDeliverablesAndSegments(): DeliverableCascadeState {
  return {
    deliverables: [],
    deliverableSegments: [],
  };
}
