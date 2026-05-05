import { pgTable, uuid, varchar, timestamp, jsonb } from 'drizzle-orm/pg-core'
import { projects } from './projects'
import { users } from './users'

export const codeReviews = pgTable('code_reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  scope: varchar('scope', { length: 50 }).notNull(), // 'full', 'uncommitted', 'recent'
  status: varchar('status', { length: 50 }).notNull().default('pending'), // 'pending', 'passed', 'failed', 'fixed', 'pushed', 'ignored'
  issuesJson: jsonb('issues_json'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
})

export type CodeReview = typeof codeReviews.$inferSelect
export type NewCodeReview = typeof codeReviews.$inferInsert
