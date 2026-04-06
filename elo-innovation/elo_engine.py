from elote import EloCompetitor
from collections import defaultdict
import math


INITIAL_RATING = 1000


def recalculate_ratings(innovations: list[dict], comparisons: list) -> dict[str, float]:
    """
    Replay all comparisons in order to get current ratings.
    Returns {innovation_id: rating}
    """
    competitors = {
        inn["id"]: EloCompetitor(initial_rating=INITIAL_RATING)
        for inn in innovations
    }

    for comp in sorted(comparisons, key=lambda c: c.created_at):
        winner = competitors.get(comp.winner_id)
        loser = competitors.get(comp.loser_id)
        if winner and loser:
            winner.beat(loser)

    return {iid: c.rating for iid, c in competitors.items()}


COMPARISONS_PER_ITEM = 3  # Each item gets compared ~this many times → good convergence


def target_comparisons(n: int) -> int:
    """Target number of comparisons for convergence. ~5x per item, capped at full round-robin."""
    return min(n * COMPARISONS_PER_ITEM, n * (n - 1) // 2)


def get_next_pair(
    innovations: list[dict],
    comparisons: list,
    ratings: dict[str, float],
) -> tuple[dict, dict] | None:
    """
    Smart pair selection with early convergence:
    1. Stop once each item has been compared ~COMPARISONS_PER_ITEM times
    2. Among eligible pairs, prioritise items that have been seen least
    3. Break ties by picking the closest-rated pair (most informative for Elo)
    Returns (innovation_a, innovation_b) or None if done
    """
    inn_ids = [i["id"] for i in innovations]
    inn_map = {i["id"]: i for i in innovations}
    n = len(inn_ids)
    target = target_comparisons(n)

    # Count how many comparisons each item has already had
    comparison_count: dict[str, int] = {iid: 0 for iid in inn_ids}
    compared_pairs: set[tuple] = set()
    for comp in comparisons:
        comparison_count[comp.winner_id] = comparison_count.get(comp.winner_id, 0) + 1
        comparison_count[comp.loser_id] = comparison_count.get(comp.loser_id, 0) + 1
        compared_pairs.add(tuple(sorted([comp.winner_id, comp.loser_id])))

    # Done if we've hit the target
    if len(compared_pairs) >= target:
        return None

    # Build candidate pairs: not yet compared, and neither item is "saturated"
    # Saturation = seen more than 2x the average comparisons per item
    avg = (len(comparisons) * 2) / n if n > 0 else 0
    saturation_limit = max(COMPARISONS_PER_ITEM, int(avg * 2) + 1)

    candidates = []
    for i in range(n):
        for j in range(i + 1, n):
            a, b = inn_ids[i], inn_ids[j]
            pair = tuple(sorted([a, b]))
            if pair in compared_pairs:
                continue
            if comparison_count[a] >= saturation_limit and comparison_count[b] >= saturation_limit:
                continue
            candidates.append((a, b))

    if not candidates:
        # All remaining pairs involve saturated items — just pick closest-rated uncovered pair
        candidates = [
            (inn_ids[i], inn_ids[j])
            for i in range(n) for j in range(i + 1, n)
            if tuple(sorted([inn_ids[i], inn_ids[j]])) not in compared_pairs
        ]
    if not candidates:
        return None

    # Score candidates: prefer items seen least, break ties by closest rating
    def score(pair):
        a, b = pair
        least_seen = min(comparison_count[a], comparison_count[b])
        rating_gap = abs(ratings.get(a, INITIAL_RATING) - ratings.get(b, INITIAL_RATING))
        return (least_seen, rating_gap)  # sort ascending: fewest comparisons first, then closest ratings

    best = min(candidates, key=score)
    return inn_map[best[0]], inn_map[best[1]]


def completion_stats(innovations: list[dict], comparisons: list) -> dict:
    n = len(innovations)
    target = target_comparisons(n)
    compared = set()
    for comp in comparisons:
        compared.add(tuple(sorted([comp.winner_id, comp.loser_id])))
    done = len(compared)
    return {
        "total_pairs": target,
        "completed_pairs": min(done, target),
        "percent": round(min(done, target) / target * 100, 1) if target > 0 else 0,
        "is_complete": done >= target,
    }


def aggregate_rankings(innovations: list[dict], all_rater_ratings: list[dict[str, float]]) -> list[dict]:
    """
    Given ratings from multiple raters, compute aggregate stats per innovation.
    Returns list of {id, title, description, mean_rating, std_dev, rank}
    """
    if not all_rater_ratings:
        return []

    scores: dict[str, list[float]] = defaultdict(list)
    for ratings in all_rater_ratings:
        for iid, rating in ratings.items():
            scores[iid].append(rating)

    inn_map = {i["id"]: i for i in innovations}
    results = []
    for iid, rating_list in scores.items():
        mean = sum(rating_list) / len(rating_list)
        variance = sum((r - mean) ** 2 for r in rating_list) / len(rating_list)
        std = math.sqrt(variance)
        results.append({
            "id": iid,
            "title": inn_map[iid]["title"],
            "description": inn_map[iid].get("description", ""),
            "mean_rating": round(mean, 1),
            "std_dev": round(std, 1),
            "num_raters": len(rating_list),
        })

    results.sort(key=lambda x: x["mean_rating"], reverse=True)
    for i, r in enumerate(results):
        r["rank"] = i + 1

    return results
