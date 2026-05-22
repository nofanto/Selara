import { Application, ApplicationSegment } from '../types';

export interface ApplicationCascadeState {
  applications: Application[];
  applicationSegments: ApplicationSegment[];
}

export function removeApplicationAndSegments(
  data: ApplicationCascadeState,
  applicationId: string,
): ApplicationCascadeState {
  return {
    applications: data.applications.filter((app) => app.id !== applicationId),
    applicationSegments: data.applicationSegments.filter((segment) => segment.applicationId !== applicationId),
  };
}

export function clearApplicationsAndSegments(): ApplicationCascadeState {
  return {
    applications: [],
    applicationSegments: [],
  };
}
