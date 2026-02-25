import { keccak256, encodePacked } from "viem";
import { prisma } from "@/server/db";

type MerkleNode = {
  hash: `0x${string}`;
  left?: MerkleNode;
  right?: MerkleNode;
};

export async function buildMerkleTree(campaignId: string): Promise<{
  merkleRoot: `0x${string}`;
  leafCount: number;
}> {
  const snapshots = await prisma.snapshotEntry.findMany({
    where: { campaignId },
  });

  if (snapshots.length === 0) {
    throw new Error("No snapshot entries found");
  }

  const leaves = snapshots.map((entry) => ({
    address: entry.address.toLowerCase(),
    amount: entry.balance,
    hash: hashLeaf(entry.address, entry.balance),
  }));

  const tree = buildTree(leaves.map((l) => l.hash));
  const root = tree.hash;

  const proofs = new Map<string, string[]>();
  leaves.forEach((leaf) => {
    const proof = getProof(tree, leaf.hash);
    proofs.set(`${leaf.address}:${leaf.amount}`, proof);
  });

  await prisma.claim.deleteMany({ where: { campaignId } });
  const claimRows = leaves.map((leaf) => ({
    campaignId,
    address: leaf.address,
    amount: leaf.amount,
    proof: JSON.stringify(proofs.get(`${leaf.address}:${leaf.amount}`) ?? []),
  }));

  const chunk = 500;
  for (let i = 0; i < claimRows.length; i += chunk) {
    await prisma.claim.createMany({
      data: claimRows.slice(i, i + chunk),
    });
  }

  await prisma.migrationCampaign.update({
    where: { id: campaignId },
    data: { merkleRoot: root, status: "ready" },
  });

  return { merkleRoot: root, leafCount: leaves.length };
}

export function hashLeaf(address: string, amount: string): `0x${string}` {
  return keccak256(
    encodePacked(["address", "uint256"], [address as `0x${string}`, BigInt(amount)]),
  );
}

function buildTree(leaves: `0x${string}`[]): MerkleNode {
  if (leaves.length === 0) {
    throw new Error("No leaves");
  }
  let nodes = leaves.map((hash) => ({ hash }));
  while (nodes.length > 1) {
    const next: MerkleNode[] = [];
    for (let i = 0; i < nodes.length; i += 2) {
      const left = nodes[i];
      const right = nodes[i + 1] ?? nodes[i];
      const [a, b] = sortPair(left.hash, right.hash);
      next.push({
        hash: keccak256(encodePacked(["bytes32", "bytes32"], [a, b])),
        left,
        right,
      });
    }
    nodes = next;
  }
  return nodes[0];
}

function sortPair(a: `0x${string}`, b: `0x${string}`): [`0x${string}`, `0x${string}`] {
  return a.toLowerCase() < b.toLowerCase() ? [a, b] : [b, a];
}

function getProof(node: MerkleNode, target: `0x${string}`): `0x${string}`[] {
  const result = findProof(node, target, []);
  return result ?? [];
}

function findProof(
  node: MerkleNode,
  target: `0x${string}`,
  path: `0x${string}`[],
): `0x${string}`[] | null {
  if (!node.left && !node.right) {
    return node.hash === target ? path : null;
  }

  if (node.left) {
    const leftPath = findProof(node.left, target, path);
    if (leftPath) {
      return node.right ? [...leftPath, node.right.hash] : leftPath;
    }
  }

  if (node.right) {
    const rightPath = findProof(node.right, target, path);
    if (rightPath) {
      return node.left ? [...rightPath, node.left.hash] : rightPath;
    }
  }

  return null;
}

export function verifyProof(params: {
  leaf: `0x${string}`;
  proof: `0x${string}`[];
  root: `0x${string}`;
}): boolean {
  let hash = params.leaf;
  for (const p of params.proof) {
    const [a, b] = sortPair(hash, p);
    hash = keccak256(encodePacked(["bytes32", "bytes32"], [a, b]));
  }
  return hash.toLowerCase() === params.root.toLowerCase();
}
