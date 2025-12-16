export const insertEmailTemplateSchema = createInsertSchema(emailTemplates).omit({
    id: true,
    createdAt: true,
    createdBy: true,
}).extend({
    attachments: z.array(z.object({
        name: z.string(),
        url: z.string(),
        type: z.string().optional()
    })).optional().default([]),
});
