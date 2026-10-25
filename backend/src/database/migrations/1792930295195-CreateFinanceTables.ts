import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateFinanceTables1792930295195 implements MigrationInterface {
    name = 'CreateFinanceTables1792930295195'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "accounts" (
                "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
                "user_id" integer NOT NULL,
                "account_type" varchar CHECK(
                    "account_type" IN (
                        'credit-card',
                        'checking',
                        'savings',
                        'investment',
                        'loan'
                    )
                ) NOT NULL,
                "bank_name" text NOT NULL,
                "branch_name" text NOT NULL,
                "card_network" varchar CHECK("card_network" IN ('mastercard', 'visa')),
                "account_number" text NOT NULL,
                "opening_balance_cents" integer NOT NULL
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_3000dad1da61b29953f0747632" ON "accounts" ("user_id")
        `);
        await queryRunner.query(`
            CREATE TABLE "transactions" (
                "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
                "account_id" integer NOT NULL,
                "occurred_at" datetime NOT NULL,
                "direction" varchar CHECK("direction" IN ('income', 'expense')) NOT NULL,
                "status" varchar CHECK("status" IN ('complete', 'pending', 'failed')) NOT NULL,
                "category" varchar CHECK(
                    "category" IN (
                        'housing',
                        'food',
                        'transportation',
                        'entertainment',
                        'shopping',
                        'others'
                    )
                ),
                "item" text NOT NULL,
                "shop_name" text NOT NULL,
                "receipt" text NOT NULL,
                "amount_cents" integer NOT NULL,
                CONSTRAINT "CHK_transactions_category" CHECK (("direction" = 'income') = ("category" IS NULL)),
                CONSTRAINT "CHK_transactions_amount" CHECK ("amount_cents" >= 0)
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_dafdff3ef797a62f76514bdab7" ON "transactions" ("account_id", "occurred_at")
        `);
        await queryRunner.query(`
            CREATE TABLE "bills" (
                "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
                "user_id" integer NOT NULL,
                "title" text NOT NULL,
                "description" text NOT NULL,
                "logo" varchar CHECK("logo" IN ('figma', 'adobe')) NOT NULL,
                "due_date" date NOT NULL,
                "last_charge_date" date NOT NULL,
                "amount_cents" integer NOT NULL,
                CONSTRAINT "CHK_bills_amount" CHECK ("amount_cents" >= 0)
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_79b94761999663211b69a08e6f" ON "bills" ("user_id", "due_date")
        `);
        await queryRunner.query(`
            CREATE TABLE "category_limits" (
                "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
                "user_id" integer NOT NULL,
                "category" varchar CHECK(
                    "category" IN (
                        'housing',
                        'food',
                        'transportation',
                        'entertainment',
                        'shopping',
                        'others'
                    )
                ) NOT NULL,
                "limit_cents" integer NOT NULL,
                CONSTRAINT "UQ_9c5f42ed4f66e7651b4cdd1af27" UNIQUE ("user_id", "category"),
                CONSTRAINT "CHK_category_limits_limit" CHECK ("limit_cents" > 0)
            )
        `);
        await queryRunner.query(`
            CREATE TABLE "savings_goals" (
                "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
                "user_id" integer NOT NULL,
                "month" text NOT NULL,
                "target_cents" integer NOT NULL,
                "present_cents" integer NOT NULL,
                CONSTRAINT "UQ_2bd049a4b314f9519c44e98a9bc" UNIQUE ("user_id", "month"),
                CONSTRAINT "CHK_savings_goals_present" CHECK ("present_cents" >= 0),
                CONSTRAINT "CHK_savings_goals_target" CHECK ("target_cents" > 0)
            )
        `);
        await queryRunner.query(`
            DROP INDEX "IDX_3000dad1da61b29953f0747632"
        `);
        await queryRunner.query(`
            CREATE TABLE "temporary_accounts" (
                "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
                "user_id" integer NOT NULL,
                "account_type" varchar CHECK(
                    "account_type" IN (
                        'credit-card',
                        'checking',
                        'savings',
                        'investment',
                        'loan'
                    )
                ) NOT NULL,
                "bank_name" text NOT NULL,
                "branch_name" text NOT NULL,
                "card_network" varchar CHECK("card_network" IN ('mastercard', 'visa')),
                "account_number" text NOT NULL,
                "opening_balance_cents" integer NOT NULL,
                CONSTRAINT "FK_3000dad1da61b29953f07476324" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
            )
        `);
        await queryRunner.query(`
            INSERT INTO "temporary_accounts"(
                    "id",
                    "user_id",
                    "account_type",
                    "bank_name",
                    "branch_name",
                    "card_network",
                    "account_number",
                    "opening_balance_cents"
                )
            SELECT "id",
                "user_id",
                "account_type",
                "bank_name",
                "branch_name",
                "card_network",
                "account_number",
                "opening_balance_cents"
            FROM "accounts"
        `);
        await queryRunner.query(`
            DROP TABLE "accounts"
        `);
        await queryRunner.query(`
            ALTER TABLE "temporary_accounts"
                RENAME TO "accounts"
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_3000dad1da61b29953f0747632" ON "accounts" ("user_id")
        `);
        await queryRunner.query(`
            DROP INDEX "IDX_dafdff3ef797a62f76514bdab7"
        `);
        await queryRunner.query(`
            CREATE TABLE "temporary_transactions" (
                "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
                "account_id" integer NOT NULL,
                "occurred_at" datetime NOT NULL,
                "direction" varchar CHECK("direction" IN ('income', 'expense')) NOT NULL,
                "status" varchar CHECK("status" IN ('complete', 'pending', 'failed')) NOT NULL,
                "category" varchar CHECK(
                    "category" IN (
                        'housing',
                        'food',
                        'transportation',
                        'entertainment',
                        'shopping',
                        'others'
                    )
                ),
                "item" text NOT NULL,
                "shop_name" text NOT NULL,
                "receipt" text NOT NULL,
                "amount_cents" integer NOT NULL,
                CONSTRAINT "CHK_transactions_category" CHECK (("direction" = 'income') = ("category" IS NULL)),
                CONSTRAINT "CHK_transactions_amount" CHECK ("amount_cents" >= 0),
                CONSTRAINT "FK_49c0d6e8ba4bfb5582000d851f0" FOREIGN KEY ("account_id") REFERENCES "accounts" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
            )
        `);
        await queryRunner.query(`
            INSERT INTO "temporary_transactions"(
                    "id",
                    "account_id",
                    "occurred_at",
                    "direction",
                    "status",
                    "category",
                    "item",
                    "shop_name",
                    "receipt",
                    "amount_cents"
                )
            SELECT "id",
                "account_id",
                "occurred_at",
                "direction",
                "status",
                "category",
                "item",
                "shop_name",
                "receipt",
                "amount_cents"
            FROM "transactions"
        `);
        await queryRunner.query(`
            DROP TABLE "transactions"
        `);
        await queryRunner.query(`
            ALTER TABLE "temporary_transactions"
                RENAME TO "transactions"
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_dafdff3ef797a62f76514bdab7" ON "transactions" ("account_id", "occurred_at")
        `);
        await queryRunner.query(`
            DROP INDEX "IDX_79b94761999663211b69a08e6f"
        `);
        await queryRunner.query(`
            CREATE TABLE "temporary_bills" (
                "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
                "user_id" integer NOT NULL,
                "title" text NOT NULL,
                "description" text NOT NULL,
                "logo" varchar CHECK("logo" IN ('figma', 'adobe')) NOT NULL,
                "due_date" date NOT NULL,
                "last_charge_date" date NOT NULL,
                "amount_cents" integer NOT NULL,
                CONSTRAINT "CHK_bills_amount" CHECK ("amount_cents" >= 0),
                CONSTRAINT "FK_03e3fcf1580c70bb68aedb999bf" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
            )
        `);
        await queryRunner.query(`
            INSERT INTO "temporary_bills"(
                    "id",
                    "user_id",
                    "title",
                    "description",
                    "logo",
                    "due_date",
                    "last_charge_date",
                    "amount_cents"
                )
            SELECT "id",
                "user_id",
                "title",
                "description",
                "logo",
                "due_date",
                "last_charge_date",
                "amount_cents"
            FROM "bills"
        `);
        await queryRunner.query(`
            DROP TABLE "bills"
        `);
        await queryRunner.query(`
            ALTER TABLE "temporary_bills"
                RENAME TO "bills"
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_79b94761999663211b69a08e6f" ON "bills" ("user_id", "due_date")
        `);
        await queryRunner.query(`
            CREATE TABLE "temporary_category_limits" (
                "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
                "user_id" integer NOT NULL,
                "category" varchar CHECK(
                    "category" IN (
                        'housing',
                        'food',
                        'transportation',
                        'entertainment',
                        'shopping',
                        'others'
                    )
                ) NOT NULL,
                "limit_cents" integer NOT NULL,
                CONSTRAINT "UQ_9c5f42ed4f66e7651b4cdd1af27" UNIQUE ("user_id", "category"),
                CONSTRAINT "CHK_category_limits_limit" CHECK ("limit_cents" > 0),
                CONSTRAINT "FK_e1b0b35f3899c2beee23ca19cfb" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
            )
        `);
        await queryRunner.query(`
            INSERT INTO "temporary_category_limits"("id", "user_id", "category", "limit_cents")
            SELECT "id",
                "user_id",
                "category",
                "limit_cents"
            FROM "category_limits"
        `);
        await queryRunner.query(`
            DROP TABLE "category_limits"
        `);
        await queryRunner.query(`
            ALTER TABLE "temporary_category_limits"
                RENAME TO "category_limits"
        `);
        await queryRunner.query(`
            CREATE TABLE "temporary_savings_goals" (
                "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
                "user_id" integer NOT NULL,
                "month" text NOT NULL,
                "target_cents" integer NOT NULL,
                "present_cents" integer NOT NULL,
                CONSTRAINT "UQ_2bd049a4b314f9519c44e98a9bc" UNIQUE ("user_id", "month"),
                CONSTRAINT "CHK_savings_goals_present" CHECK ("present_cents" >= 0),
                CONSTRAINT "CHK_savings_goals_target" CHECK ("target_cents" > 0),
                CONSTRAINT "FK_acf18d62676b7b640f44cc6eba5" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
            )
        `);
        await queryRunner.query(`
            INSERT INTO "temporary_savings_goals"(
                    "id",
                    "user_id",
                    "month",
                    "target_cents",
                    "present_cents"
                )
            SELECT "id",
                "user_id",
                "month",
                "target_cents",
                "present_cents"
            FROM "savings_goals"
        `);
        await queryRunner.query(`
            DROP TABLE "savings_goals"
        `);
        await queryRunner.query(`
            ALTER TABLE "temporary_savings_goals"
                RENAME TO "savings_goals"
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "savings_goals"
                RENAME TO "temporary_savings_goals"
        `);
        await queryRunner.query(`
            CREATE TABLE "savings_goals" (
                "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
                "user_id" integer NOT NULL,
                "month" text NOT NULL,
                "target_cents" integer NOT NULL,
                "present_cents" integer NOT NULL,
                CONSTRAINT "UQ_2bd049a4b314f9519c44e98a9bc" UNIQUE ("user_id", "month"),
                CONSTRAINT "CHK_savings_goals_present" CHECK ("present_cents" >= 0),
                CONSTRAINT "CHK_savings_goals_target" CHECK ("target_cents" > 0)
            )
        `);
        await queryRunner.query(`
            INSERT INTO "savings_goals"(
                    "id",
                    "user_id",
                    "month",
                    "target_cents",
                    "present_cents"
                )
            SELECT "id",
                "user_id",
                "month",
                "target_cents",
                "present_cents"
            FROM "temporary_savings_goals"
        `);
        await queryRunner.query(`
            DROP TABLE "temporary_savings_goals"
        `);
        await queryRunner.query(`
            ALTER TABLE "category_limits"
                RENAME TO "temporary_category_limits"
        `);
        await queryRunner.query(`
            CREATE TABLE "category_limits" (
                "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
                "user_id" integer NOT NULL,
                "category" varchar CHECK(
                    "category" IN (
                        'housing',
                        'food',
                        'transportation',
                        'entertainment',
                        'shopping',
                        'others'
                    )
                ) NOT NULL,
                "limit_cents" integer NOT NULL,
                CONSTRAINT "UQ_9c5f42ed4f66e7651b4cdd1af27" UNIQUE ("user_id", "category"),
                CONSTRAINT "CHK_category_limits_limit" CHECK ("limit_cents" > 0)
            )
        `);
        await queryRunner.query(`
            INSERT INTO "category_limits"("id", "user_id", "category", "limit_cents")
            SELECT "id",
                "user_id",
                "category",
                "limit_cents"
            FROM "temporary_category_limits"
        `);
        await queryRunner.query(`
            DROP TABLE "temporary_category_limits"
        `);
        await queryRunner.query(`
            DROP INDEX "IDX_79b94761999663211b69a08e6f"
        `);
        await queryRunner.query(`
            ALTER TABLE "bills"
                RENAME TO "temporary_bills"
        `);
        await queryRunner.query(`
            CREATE TABLE "bills" (
                "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
                "user_id" integer NOT NULL,
                "title" text NOT NULL,
                "description" text NOT NULL,
                "logo" varchar CHECK("logo" IN ('figma', 'adobe')) NOT NULL,
                "due_date" date NOT NULL,
                "last_charge_date" date NOT NULL,
                "amount_cents" integer NOT NULL,
                CONSTRAINT "CHK_bills_amount" CHECK ("amount_cents" >= 0)
            )
        `);
        await queryRunner.query(`
            INSERT INTO "bills"(
                    "id",
                    "user_id",
                    "title",
                    "description",
                    "logo",
                    "due_date",
                    "last_charge_date",
                    "amount_cents"
                )
            SELECT "id",
                "user_id",
                "title",
                "description",
                "logo",
                "due_date",
                "last_charge_date",
                "amount_cents"
            FROM "temporary_bills"
        `);
        await queryRunner.query(`
            DROP TABLE "temporary_bills"
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_79b94761999663211b69a08e6f" ON "bills" ("user_id", "due_date")
        `);
        await queryRunner.query(`
            DROP INDEX "IDX_dafdff3ef797a62f76514bdab7"
        `);
        await queryRunner.query(`
            ALTER TABLE "transactions"
                RENAME TO "temporary_transactions"
        `);
        await queryRunner.query(`
            CREATE TABLE "transactions" (
                "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
                "account_id" integer NOT NULL,
                "occurred_at" datetime NOT NULL,
                "direction" varchar CHECK("direction" IN ('income', 'expense')) NOT NULL,
                "status" varchar CHECK("status" IN ('complete', 'pending', 'failed')) NOT NULL,
                "category" varchar CHECK(
                    "category" IN (
                        'housing',
                        'food',
                        'transportation',
                        'entertainment',
                        'shopping',
                        'others'
                    )
                ),
                "item" text NOT NULL,
                "shop_name" text NOT NULL,
                "receipt" text NOT NULL,
                "amount_cents" integer NOT NULL,
                CONSTRAINT "CHK_transactions_category" CHECK (("direction" = 'income') = ("category" IS NULL)),
                CONSTRAINT "CHK_transactions_amount" CHECK ("amount_cents" >= 0)
            )
        `);
        await queryRunner.query(`
            INSERT INTO "transactions"(
                    "id",
                    "account_id",
                    "occurred_at",
                    "direction",
                    "status",
                    "category",
                    "item",
                    "shop_name",
                    "receipt",
                    "amount_cents"
                )
            SELECT "id",
                "account_id",
                "occurred_at",
                "direction",
                "status",
                "category",
                "item",
                "shop_name",
                "receipt",
                "amount_cents"
            FROM "temporary_transactions"
        `);
        await queryRunner.query(`
            DROP TABLE "temporary_transactions"
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_dafdff3ef797a62f76514bdab7" ON "transactions" ("account_id", "occurred_at")
        `);
        await queryRunner.query(`
            DROP INDEX "IDX_3000dad1da61b29953f0747632"
        `);
        await queryRunner.query(`
            ALTER TABLE "accounts"
                RENAME TO "temporary_accounts"
        `);
        await queryRunner.query(`
            CREATE TABLE "accounts" (
                "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
                "user_id" integer NOT NULL,
                "account_type" varchar CHECK(
                    "account_type" IN (
                        'credit-card',
                        'checking',
                        'savings',
                        'investment',
                        'loan'
                    )
                ) NOT NULL,
                "bank_name" text NOT NULL,
                "branch_name" text NOT NULL,
                "card_network" varchar CHECK("card_network" IN ('mastercard', 'visa')),
                "account_number" text NOT NULL,
                "opening_balance_cents" integer NOT NULL
            )
        `);
        await queryRunner.query(`
            INSERT INTO "accounts"(
                    "id",
                    "user_id",
                    "account_type",
                    "bank_name",
                    "branch_name",
                    "card_network",
                    "account_number",
                    "opening_balance_cents"
                )
            SELECT "id",
                "user_id",
                "account_type",
                "bank_name",
                "branch_name",
                "card_network",
                "account_number",
                "opening_balance_cents"
            FROM "temporary_accounts"
        `);
        await queryRunner.query(`
            DROP TABLE "temporary_accounts"
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_3000dad1da61b29953f0747632" ON "accounts" ("user_id")
        `);
        await queryRunner.query(`
            DROP TABLE "savings_goals"
        `);
        await queryRunner.query(`
            DROP TABLE "category_limits"
        `);
        await queryRunner.query(`
            DROP INDEX "IDX_79b94761999663211b69a08e6f"
        `);
        await queryRunner.query(`
            DROP TABLE "bills"
        `);
        await queryRunner.query(`
            DROP INDEX "IDX_dafdff3ef797a62f76514bdab7"
        `);
        await queryRunner.query(`
            DROP TABLE "transactions"
        `);
        await queryRunner.query(`
            DROP INDEX "IDX_3000dad1da61b29953f0747632"
        `);
        await queryRunner.query(`
            DROP TABLE "accounts"
        `);
    }

}
