# Running Migrator CLI

- Generate a new migration file
    ```sh
    cargo run -p migration --features cli -- generate MIGRATION_NAME
    ```
- Apply all pending migrations
    ```sh
    cargo run -p migration --features cli
    ```
    ```sh
    cargo run -p migration --features cli -- up
    ```
- Apply first 10 pending migrations
    ```sh
    cargo run -p migration --features cli -- up -n 10
    ```
- Rollback last applied migrations
    ```sh
    cargo run -p migration --features cli -- down
    ```
- Rollback last 10 applied migrations
    ```sh
    cargo run -p migration --features cli -- down -n 10
    ```
- Drop all tables from the database, then reapply all migrations
    ```sh
    cargo run -p migration --features cli -- fresh
    ```
- Rollback all applied migrations, then reapply all migrations
    ```sh
    cargo run -p migration --features cli -- refresh
    ```
- Rollback all applied migrations
    ```sh
    cargo run -p migration --features cli -- reset
    ```
- Check the status of all migrations
    ```sh
    cargo run -p migration --features cli -- status
    ```
