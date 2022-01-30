---
layout: post
title:  "Using migra for database migrations"
date:   2022-01-17 20:48:12 +0000
categories: postgresql python databases
---
# Using migra for database migrations

Database schema migrations are a tough part of working with databases whether you let your framework (eg: rails, django) manage your schema or you choose to do it yourself. We opted for a simpler set of scripts that applied all the sql files in a directory in order to build up the schema. The directory listing looks something like this:

```
000-baseline.sql
001-add-sample-table.sql
002-add-pack-table.sql
```
When you want to change/modify an object, you simply add a new sql file with the next number in the list to make your change.

Postgres offers an official docker image to do exactly this task.

```dockerfile
FROM postgres:10-alpine
ADD ./migrations /docker-entrypoint-initdb.d/
ENV POSTGRES_DB your_database_name
```

This image creates a new postgresql server with a database called `your_database_name` and runs through the migrations in `/docker-entrypoint-initdb.d/` sequentially.

For local development, we use docker-compose to test our application with a fresh copy of our database schema in a known state. 

```yaml
version: "3.4"
services:
  db:
    build:
      context: ./db
  tests:
    build:
        context: .
    depends_on:
      - db
    links:
      - db
    command: npm test
```

This runs our tests against the freshly created local database.

Initially, when we were ready to go to the test environment we manually ran the latest migration, deployed our application and ran our smoke tests against it. If that went well, we repeated the process in production.

This worked up to a point, however as our application and database grew, migrations became more tricky. We needed to think carefully about how they affected existing data, about users of specific database functions expecting a certain signature and generally about how to avoid downtime during migrations.

If migrations are tricky and need to be run in stages manually, you will undoubtedly sooner or later end up with schemas that vary between what's in git, what's in the test environment and what's in production.

This happened to us after releasing some new database orientated features and caused a couple of bugs in production that were hard to track down and were due to migrations been not fully or not applied across both our environments.

To avoid this from happening again, we added [migra](https://pypi.org/project/migra/) to our CI pipeline. Migra allows you to compare 2 database schemas and output the code required to make them identical. Think of it like a diff for database schemas. When we push a change to an environment, We compare the schema we've tested against in docker with the environment we're targetting.

```bash
docker-compose run tests migra \
  --unsafe \
  --with-privileges \
  postgresql://$user:$password@$host:$port/$database \
  postgresql://postgres:password@db/$database
```

If they are not identical, the build fails and outputs the SQL code needed to bring the environment's schema in line with what the code is expecting.

From there, we have the choice to run the output code in that environment or to structure the migrations differently to prevent data loss. Most of the time, the migration that was used to modify the docker image for the local tests can simply be used.

Once the migrations have been run in the target environment, the build can be rerun and will continue to deploy the application code now that the database schema is up to date. This ensures that our environments remain in sync with each other and what we are testing against.
