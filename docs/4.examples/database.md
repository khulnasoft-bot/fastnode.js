---
navigation:
  category: features
icon: i-lucide-database
---

# Database

> Built-in database support with SQL template literals.

<!-- automd:ui-code-tree src="../../examples/database" default="server.ts" ignore="README.md,GUIDE.md" expandAll -->

::code-tree{defaultValue="server.ts" expandAll}

```ts [fastnode.config.ts]
import { defineConfig } from "fastnode";

export default defineConfig({
  experimental: {
    database: true,
    tasks: true,
  },
  database: {
    default: { connector: "sqlite" },
  },
});
```

```json [package.json]
{
  "type": "module",
  "scripts": {
    "dev": "fastnode dev",
    "build": "fastnode build"
  },
  "dependencies": {
    "db0": "^0.4.2"
  },
  "devDependencies": {
    "fastnode": "latest",
    "rolldown": "latest"
  }
}
```

```ts [server.ts]
import { defineHandler } from "fastnode";
import { useDatabase } from "fastnode/database";

export default defineHandler(async () => {
  const db = useDatabase();

  // Create users table
  await db.sql`DROP TABLE IF EXISTS users`;
  await db.sql`CREATE TABLE IF NOT EXISTS users ("id" TEXT PRIMARY KEY, "firstName" TEXT, "lastName" TEXT, "email" TEXT)`;

  // Add a new user
  const userId = String(Math.round(Math.random() * 10_000));
  await db.sql`INSERT INTO users VALUES (${userId}, 'John', 'Doe', '')`;

  // Query for users
  const { rows } = await db.sql`SELECT * FROM users WHERE id = ${userId}`;

  return {
    rows,
  };
});
```

```json [tsconfig.json]
{
  "extends": "fastnode/tsconfig"
}
```

```ts [vite.config.ts]
import { defineConfig } from "vite";
import { fastnode } from "fastnode/vite";

export default defineConfig({ plugins: [fastnode()] });
```

```ts [tasks/db/migrate.ts]
import { defineTask } from "fastnode/task";
import { useDatabase } from "fastnode/database";

export default defineTask({
  meta: {
    description: "Run database migrations",
  },
  async run() {
    const db = useDatabase();

    console.log("Running database migrations...");

    // Create users table
    await db.sql`DROP TABLE IF EXISTS users`;
    await db.sql`CREATE TABLE IF NOT EXISTS users ("id" TEXT PRIMARY KEY, "firstName" TEXT, "lastName" TEXT, "email" TEXT)`;

    return {
      result: "Database migrations complete!",
    };
  },
});
```

::

<!-- /automd -->

<!-- automd:file src="../../examples/database/README.md" -->

Fastnode provides a built-in database layer that uses SQL template literals for safe, parameterized queries. This example creates a users table, inserts a record, and queries it back.

## Querying the Database

```ts [server.ts]
import { defineHandler } from "fastnode";
import { useDatabase } from "fastnode/database";

export default defineHandler(async () => {
  const db = useDatabase();

  // Create users table
  await db.sql`DROP TABLE IF EXISTS users`;
  await db.sql`CREATE TABLE IF NOT EXISTS users ("id" TEXT PRIMARY KEY, "firstName" TEXT, "lastName" TEXT, "email" TEXT)`;

  // Add a new user
  const userId = String(Math.round(Math.random() * 10_000));
  await db.sql`INSERT INTO users VALUES (${userId}, 'John', 'Doe', '')`;

  // Query for users
  const { rows } = await db.sql`SELECT * FROM users WHERE id = ${userId}`;

  return {
    rows,
  };
});
```

Retrieve the database instance using `useDatabase()`. The database can be queried using `db.sql`, and variables like `${userId}` are automatically escaped to prevent SQL injection.

## Running Migrations with Tasks

Fastnode tasks let you run operations outside of request handlers. For database migrations, create a task file in `tasks/` and run it via the CLI. This keeps schema changes separate from your application code.

```ts [tasks/db/migrate.ts]
import { defineTask } from "fastnode/task";
import { useDatabase } from "fastnode/database";

export default defineTask({
  meta: {
    description: "Run database migrations",
  },
  async run() {
    const db = useDatabase();

    console.log("Running database migrations...");

    // Create users table
    await db.sql`DROP TABLE IF EXISTS users`;
    await db.sql`CREATE TABLE IF NOT EXISTS users ("id" TEXT PRIMARY KEY, "firstName" TEXT, "lastName" TEXT, "email" TEXT)`;

    return {
      result: "Database migrations complete!",
    };
  },
});
```

<!-- /automd -->

## Learn More

- [Database](/docs/database)
- [Tasks](/docs/tasks)
