import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsersAndSessions1792921656294 implements MigrationInterface {
  name = 'CreateUsersAndSessions1792921656294';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE "users" (
                "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
                "email" text NOT NULL,
                "full_name" text NOT NULL,
                "username" text NOT NULL,
                "password_hash" text,
                CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"),
                CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710" UNIQUE ("username")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "sessions" (
                "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
                "token_hash" text NOT NULL,
                "user_id" integer NOT NULL,
                "expires_at" datetime NOT NULL,
                CONSTRAINT "UQ_abaa9e068cdd390bc5210f79884" UNIQUE ("token_hash")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_085d540d9f418cfbdc7bd55bb1" ON "sessions" ("user_id")
        `);
    await queryRunner.query(`
            DROP INDEX "IDX_085d540d9f418cfbdc7bd55bb1"
        `);
    await queryRunner.query(`
            CREATE TABLE "temporary_sessions" (
                "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
                "token_hash" text NOT NULL,
                "user_id" integer NOT NULL,
                "expires_at" datetime NOT NULL,
                CONSTRAINT "UQ_abaa9e068cdd390bc5210f79884" UNIQUE ("token_hash"),
                CONSTRAINT "FK_085d540d9f418cfbdc7bd55bb19" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
            )
        `);
    await queryRunner.query(`
            INSERT INTO "temporary_sessions"("id", "token_hash", "user_id", "expires_at")
            SELECT "id",
                "token_hash",
                "user_id",
                "expires_at"
            FROM "sessions"
        `);
    await queryRunner.query(`
            DROP TABLE "sessions"
        `);
    await queryRunner.query(`
            ALTER TABLE "temporary_sessions"
                RENAME TO "sessions"
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_085d540d9f418cfbdc7bd55bb1" ON "sessions" ("user_id")
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            DROP INDEX "IDX_085d540d9f418cfbdc7bd55bb1"
        `);
    await queryRunner.query(`
            ALTER TABLE "sessions"
                RENAME TO "temporary_sessions"
        `);
    await queryRunner.query(`
            CREATE TABLE "sessions" (
                "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
                "token_hash" text NOT NULL,
                "user_id" integer NOT NULL,
                "expires_at" datetime NOT NULL,
                CONSTRAINT "UQ_abaa9e068cdd390bc5210f79884" UNIQUE ("token_hash")
            )
        `);
    await queryRunner.query(`
            INSERT INTO "sessions"("id", "token_hash", "user_id", "expires_at")
            SELECT "id",
                "token_hash",
                "user_id",
                "expires_at"
            FROM "temporary_sessions"
        `);
    await queryRunner.query(`
            DROP TABLE "temporary_sessions"
        `);
    await queryRunner.query(`
            CREATE INDEX "IDX_085d540d9f418cfbdc7bd55bb1" ON "sessions" ("user_id")
        `);
    await queryRunner.query(`
            DROP INDEX "IDX_085d540d9f418cfbdc7bd55bb1"
        `);
    await queryRunner.query(`
            DROP TABLE "sessions"
        `);
    await queryRunner.query(`
            DROP TABLE "users"
        `);
  }
}
