#!/usr/bin/env python3
"""One-off: rewrite terse pattern summaries in plain English and add `plain` + `whenToUse`
to the authored pattern files. Idempotent — safe to re-run."""
import json, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent / 'data' / 'patterns'

SUMMARIES = {
    'prefix-sum-hash':      "Answer 'sum of any range' instantly by storing running totals; count ranges with a target sum using a hash map.",
    'monotonic-stack':      "For every element, find the nearest bigger (or smaller) one to its left or right, all in a single pass.",
    'two-pointers-sorted':  "Find a pair (or shrink a range) in sorted data by walking one pointer from each end toward the middle.",
    'sliding-window':       "Find the longest or shortest stretch of consecutive elements that obeys a rule, by growing the right edge and shrinking the left.",
    'binary-search-answer': "When you can't compute the answer but can check 'is X good enough?', binary-search over X itself.",
    'bfs-grid':             "Fewest steps from a start to a target when every step costs the same: explore in rings, first arrival wins.",
    'dfs-backtracking':     "List every valid combination by making one choice at a time, going deeper, and undoing the choice on the way back.",
    'union-find':           "Keep track of which items belong to the same group while groups keep merging; 'are these two connected?' in near O(1).",
    'topological-sort':     "Put tasks in an order that respects 'A before B' rules, and spot when the rules contradict each other (a cycle).",
    'dijkstra':             "Cheapest route between points when each road has its own positive cost: always extend the cheapest known route next.",
    'heap-topk':            "Keep only the k best things you've seen so far (or always grab the smallest of many streams) with a priority queue.",
    'intervals':            "Sort time ranges by start, then sweep left to right merging, counting overlaps, or picking non-overlapping ones.",
    'dp-1d':                "Solve 'best answer for the first i elements' using the answers for slightly shorter prefixes, filling a table left to right.",
    'dp-grid':              "Two-dimensional table: the answer for cell (i, j) comes from its neighbours — grids, or two strings compared prefix by prefix.",
    'dp-knapsack':          "Pick items under a limit (weight, budget, target sum): a table over 'how much capacity is left' tells you what is reachable.",
    'dp-interval':          "Best way to process a range [l, r] by choosing which element is handled last, then solving the two sides.",
    'dp-bitmask':           "When n ≤ ~20, represent 'which items are used so far' as bits of an integer and DP over all 2^n subsets.",
    'trie':                 "A tree of letters so that looking up words, prefixes or 'does any word start with…' is proportional to word length, not dictionary size.",
    'linked-list':          "Slow/fast pointers to find middles and cycles, in-place reversal, and a dummy head so the first node is never a special case.",
    'tree-recursion':       "Each recursive call returns a tiny summary of its subtree (height, sum, best path); the parent combines the children's summaries.",
    'greedy-sort':          "Sort by the right key, then take the locally best choice every time; justify it by showing swapping never helps.",
    'fenwick-segment':      "Range queries mixed with updates in O(log n); also the standard tool for 'count smaller elements after me'.",
    'divide-conquer':       "Split in half, solve each half, then count the pairs that straddle the middle during the merge (like merge sort).",
    'design-hashing':       "Build data structures with O(1) operations by pairing a hash map with an array or a doubly linked list (LRU, O(1) getRandom).",
    'math-counting':        "Closed-form formulas, modular arithmetic, parity and pigeonhole arguments that replace a loop with a calculation.",
}

PLAIN = {
    'monotonic-stack': (
        "You walk through the array once, carrying a stack of elements that are still waiting to find out 'who is the first bigger one after me?'. "
        "Whenever a new element is bigger than the one on top of the stack, the top has found its answer — pop it and write the answer down. "
        "Because each element is pushed once and popped at most once, the whole thing is linear.",
        "the question is 'for each element, what is the nearest element to the left/right that is bigger/smaller?' — or anything built from that, like histogram rectangles or 'how far can I see'."),
    'prefix-sum-hash': (
        "Keep a running total P[i] = sum of the first i numbers. Then the sum of any stretch from l to r is just P[r] - P[l], two lookups instead of a loop. "
        "If the question is 'how many stretches sum to k?', that turns into 'how many pairs of running totals differ by k?', and a hash map counts pairs in one pass.",
        "the statement talks about subarray sums, counts of subarrays with some sum property, or many 'sum between l and r' queries."),
    'two-pointers-sorted': (
        "Put one pointer at each end of the sorted data. Compare the two elements: that single comparison tells you which end can never be part of a better answer, so you move that pointer inward and never look back. "
        "The pointers meet after at most n steps.",
        "the input is sorted (or you can sort it) and you need a pair, a closest match, or to squeeze a range from both sides."),
    'sliding-window': (
        "Two pointers that both only move right. Extend the right edge one element at a time; the moment the window breaks the rule (too many distinct letters, sum too big…), move the left edge right until it obeys again. "
        "After every step you can read off a candidate answer.",
        "the answer is a contiguous stretch (substring / subarray) that must be the longest or shortest one satisfying a condition that only gets harder as the window grows."),
    'binary-search-answer': (
        "You can't compute the answer directly, but you can cheaply check a guess: 'could we finish in 5 days?' 'could every box carry at most 10?'. "
        "If a guess works, every bigger guess also works — so the answers form a yes/no boundary and binary search finds it in log steps.",
        "you see 'minimise the maximum', 'smallest speed/capacity/days such that…', and checking a fixed value is easy."),
    'bfs-grid': (
        "Start from the source(s) and explore in rings: everything 1 step away, then everything 2 steps away, and so on. "
        "The first time you reach a cell is guaranteed to be the shortest way there, because all shorter routes were already explored.",
        "every move costs the same and you need fewest steps / shortest path / how long until everything is reached — especially on a grid, and especially with several starting points at once."),
    'dfs-backtracking': (
        "Build a solution one decision at a time. Make a choice, go deeper, and when you come back undo that choice so the partial solution is exactly as it was. "
        "Stop going deeper the moment the partial solution can no longer be completed.",
        "you must list all combinations, permutations, subsets, or placements — or find one valid arrangement — and n is small enough that trying everything (with pruning) is acceptable."),
    'dp-1d': (
        "Write down, in one sentence, what 'the answer for the first i elements' means. Then ask: how does it follow from the answers for i-1, i-2…? "
        "Fill the table from left to right and the last cell is your answer. It is recursion where repeated sub-questions are remembered instead of recomputed.",
        "the problem is over a sequence, the answer for a prefix depends on a few earlier prefixes, and you hear 'number of ways', 'maximum sum with a constraint', 'minimum cost to reach the end'."),
}

# update index
idx_path = ROOT / 'index.json'
index = json.loads(idx_path.read_text())
for p in index:
    if p['id'] in SUMMARIES:
        p['summary'] = SUMMARIES[p['id']]
idx_path.write_text(json.dumps(index, indent=2, ensure_ascii=False) + '\n')

# update authored patterns
for pid, (plain, when) in PLAIN.items():
    f = ROOT / f'{pid}.json'
    if not f.exists():
        continue
    d = json.loads(f.read_text())
    d['plain'] = plain
    d['whenToUse'] = when
    # keep field order readable: id, name, cues, plain, whenToUse, invariant, ...
    order = ['id', 'name', 'cues', 'plain', 'whenToUse', 'invariant']
    out = {k: d[k] for k in order if k in d}
    out.update({k: v for k, v in d.items() if k not in out})
    f.write_text(json.dumps(out, indent=2, ensure_ascii=False) + '\n')
    print('updated', pid)
print('index summaries rewritten:', sum(p['id'] in SUMMARIES for p in index))
