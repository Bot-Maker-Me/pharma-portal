'use client'

import { EmployeeRequests } from './employee-requests'

/**
 * Standalone entry point for `/workspace/employee_requests`. The feature route
 * (app/workspace/[feature]) has already applied the feature flag — it shows the
 * "not available yet" page when the pharmacy is off, and labels an admin preview.
 */
export default function EmployeeRequestsRoute() {
  return <EmployeeRequests />
}
