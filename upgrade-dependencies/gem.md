# gem branch

## inventory

- inspect `Gemfile` and `Gemfile.lock`
- include the ruby runtime from `.mise.toml`, `.ruby-version`, and the Gemfile/lockfile runtime declarations; resolve the newest stable ruby release within the skill's runtime ceiling through mise, even when these pins are exact
- `bundle outdated --only-explicit --minor`: its `Latest` column is the desired non-major version
- `bundle outdated --only-explicit --filter-major`: the major-only list; its `Latest` column is the major target
- bundler needs rubygems network access; run it escalated in a sandbox, and through `mise exec -- bundle ...` when it complains about the ruby version
- manifest policy: keep each `Gemfile` constraint style when moving it

## groups

up to 6, by what the dependency does:

- `runtime`: ruby
- `rails`: the framework, app server, boot and load-path caching, database adapters and migration safety, and the rails-native storage, queue, cache, and logging layers
- `auth`: authentication, invitations, oauth providers, one-time passwords, tokens, and authorization
- `tooling`: the typing toolchain and its RBI generators, linting, formatting, security scanning, dead-code detection, schema annotation, and coverage
- `test`: test frameworks, mocking, HTTP recording, browser and system testing, and development-only debugging tools
- `everything-else`: third-party API clients and every remaining candidate

coupled family: a gem and its runtime, its plugins or adapters, its `*-rails` wrapper

## checks

- `BUNDLE_FROZEN=true bundle install` and `bundle exec tapioca gems --verify`
- `bash bin/sorbet-check` and `bin/test-hot backend --base <merge-base SHA> --head HEAD` one after the other (together they deadlock postgres). get the SHA from a separate `git merge-base HEAD origin/develop` call and paste it literally: `--base origin/develop` diffs from develop's tip, not the merge base. a lockfile diff selects the full backend suite, about 7 minutes; "no hot backend test inputs found" means the range was wrong, not that tests passed
- `bin/rails zeitwerk:check`, `bin/rubocop <changed .rb files>`, and `bundle exec bundler-audit check --update` can run in parallel alongside; `bin/rubocop` over the whole repo prints about 9k baseline offences, and neither rubocop nor brakeman runs in CI
- `bundle exec brakeman -q --no-pager` when app code changed; the `bin/brakeman` wrapper exits early whenever a newer brakeman exists

## worker

- skills: `/backend`, `/rails-*`, and `/tdd` when call sites change
- lockfile recipe: `bundle update --conservative <gems>`; when `--conservative` cannot resolve, drop it for that gem only and list every transitive gem that moved. `BUNDLED WITH` stays at its ceiling; the runtime group owns changes to `RUBY VERSION`
- `runtime`: review release notes for intermediate ruby minors, synchronise `.mise.toml`, `.ruby-version`, the Gemfile/lockfile runtime declarations, and related CI/deploy references and version fixtures; reinstall native gems and run the backend checks under the target ruby. preserve exact pins after upgrading
- after every lockfile change run `bundle exec tapioca gems` then `bash bin/tapioca-dsl-ci`, and commit `sorbet/rbi/` together with `Gemfile.lock`. for the sorbet gems themselves `tapioca gems` is a no-op; the evidence is a baseline-vs-upgraded `srb tc` diff
- when an upgraded gem generates committed files, run its generator on the old version first as a baseline, then on the new, and commit only the delta the version change explains: model annotations for `annotaterb` (`bundle exec annotaterb models`, local schema drift stays out), formatting for the prettier ruby plugin (`bin/format-changed-files`), and the equivalent for any other generator
- major mode, which gems constrain the target: `bundle exec gem dependency <gem> --reverse-dependencies` and the dependencies section of `Gemfile.lock`
- runtime surfaces: auth flows for `auth`, jobs and cache for `solid_*`, LLM streaming for `ruby-openai`, uploads for `aws-sdk-s3`; production-mode boot probes need `bundle exec dotenv -f .env`
- development Active Storage writes to the staging S3 bucket, and UI and endpoint uploads cannot opt out; smoke-test uploads run in `bin/rails runner` with `service_name: 'local'` to stay on local disk. for `aws-sdk-s3`, start that runner script with `require 'aws-sdk-s3'; Aws.config[:s3] = { stub_responses: true }`, abort unless `ActiveStorage::Blob.service.client.client.config.stub_responses`, then upload through the default service
- `tooling`: report every new or changed `srb tc` error alongside the new cops
