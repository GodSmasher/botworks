// Offline (mock mode) conflict resolution for the data-sync bot.

const PLACEHOLDER = /^(|-|–|n\/?a|null|none|unknown|unbekannt|tbd|todo|test|xxx+|k\.\s?a\.)$/i

function isPlaceholder(value: string): boolean {
  return PLACEHOLDER.test(value.trim())
}

/**
 * Picks a winner for two conflicting values:
 * placeholder/empty side loses → otherwise the newer timestamp wins → otherwise flag for manual review.
 */
export function mockResolveConflict(
  field: string,
  sourceValue: string,
  targetValue: string,
  sourceUpdatedAt?: string,
  targetUpdatedAt?: string,
) {
  const sourceEmpty = isPlaceholder(sourceValue)
  const targetEmpty = isPlaceholder(targetValue)

  if (sourceEmpty && !targetEmpty) {
    return {
      resolution: 'target_wins' as const,
      chosenValue: targetValue,
      reason: `Source value for "${field}" is empty or a placeholder, target holds real data.`,
    }
  }
  if (targetEmpty && !sourceEmpty) {
    return {
      resolution: 'source_wins' as const,
      chosenValue: sourceValue,
      reason: `Target value for "${field}" is empty or a placeholder, source holds real data.`,
    }
  }

  const sourceTime = sourceUpdatedAt ? Date.parse(sourceUpdatedAt) : NaN
  const targetTime = targetUpdatedAt ? Date.parse(targetUpdatedAt) : NaN

  if (!Number.isNaN(sourceTime) && !Number.isNaN(targetTime) && sourceTime !== targetTime) {
    const sourceIsNewer = sourceTime > targetTime
    return {
      resolution: 'newest_wins' as const,
      chosenValue: sourceIsNewer ? sourceValue : targetValue,
      reason: `${sourceIsNewer ? 'Source' : 'Target'} record was updated more recently (${sourceIsNewer ? sourceUpdatedAt : targetUpdatedAt}).`,
    }
  }

  return {
    resolution: 'manual' as const,
    chosenValue: sourceValue,
    reason: `Both values for "${field}" look valid and no usable timestamps are available — needs human review.`,
  }
}
