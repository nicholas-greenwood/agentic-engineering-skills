# diff handoff for existing work

for a new loop that skips step 2, create or switch to its PR branch, follow /git, then run from the checkout before loop edits; committing existing work is authorised by the loop:

```bash
loop_dir="$(git rev-parse --show-toplevel)/playground/loops/<loop-name>"
mkdir -p "$loop_dir"
if [ ! -f "$loop_dir/start-head" ]; then
  if [ -n "$(git status --porcelain --untracked-files=all)" ]; then
    git add -A &&
      git commit -m "chore: save existing work before loop" || exit 1
  fi
  git rev-parse HEAD > "$loop_dir/start-head" || exit 1
fi
```

on resume, keep the original `start-head`; if an existing loop has no saved baseline, report that limit rather than substituting `HEAD` or the PR base

after all intended work is committed, before either finished or stopped final report, run:

```bash
loop_dir="$(git rev-parse --show-toplevel)/playground/loops/<loop-name>"
git diff --no-ext-diff --no-textconv --no-color --binary --stat --patch \
  "$(cat "$loop_dir/start-head")" HEAD -- > "$loop_dir/loop-changes.diff" || exit 1
```

include a clickable Markdown link to the generated file's absolute path in the final report: `[loop diff](<absolute-path-to-loop-changes.diff>)`. leave opening the file to the user; launch an editor only when requested

the file contains a summary and the full patch; an empty file means no net committed changes. unchanged entry work is absent; concurrent committed edits and upstream changes from rebases are included
