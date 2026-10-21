'use client'

import { TeamChat } from './team-chat'

/**
 * Standalone entry point for `/workspace/team_chat`. The feature route
 * (app/workspace/[feature]) has already applied the feature flag — it shows the
 * "not available yet" page when the pharmacy is off, and labels an admin preview.
 */
export default function TeamChatRoute() {
  return <TeamChat />
}
