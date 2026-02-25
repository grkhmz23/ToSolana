export type CampaignStatus = "draft" | "snapshotting" | "ready" | "live" | "ended";

const transitions: Record<CampaignStatus, CampaignStatus[]> = {
  draft: ["snapshotting"],
  snapshotting: ["ready"],
  ready: ["live"],
  live: ["ended"],
  ended: [],
};

export function canTransition(from: CampaignStatus, to: CampaignStatus): boolean {
  return transitions[from]?.includes(to) ?? false;
}
