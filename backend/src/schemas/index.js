import { z } from 'zod';
const txt = (min, max) => z.string().trim().min(min).max(max);
const optTxt = (max) => z.string().trim().max(max).optional().default('');
export const registerSchema = z.object({ name: txt(2, 80), email: z.string().trim().toLowerCase().email().max(120), password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères.').max(72), role: z.enum(['YOUTH', 'COMPANY']) });
export const loginSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(72) });
export const profileSchema = z.object({ title: optTxt(80), bio: optTxt(600), city: optTxt(80), languages: optTxt(120), availability: optTxt(120), portfolioUrl: z.string().trim().max(300).optional().default('') });
export const prefsSchema = z.object({ shareProofs: z.boolean(), shareWorks: z.boolean() });
export const discoverSchema = z.object({ text: txt(20, 3000) });
export const confirmSkillsSchema = z.object({ names: z.array(txt(1, 60)).min(1).max(10) });
export const submissionSchema = z.object({ challengeId: txt(1, 60), kind: z.enum(['IMAGE', 'VIDEO', 'DOCUMENT', 'LINK']), url: z.string().trim().max(500).optional(), description: optTxt(500), fileKey: z.string().max(60).optional(), ticket: z.string().max(100).optional(), fileName: optTxt(100) });
export const uploadUrlSchema = z.object({ challengeId: txt(1, 60), kind: z.enum(['IMAGE', 'VIDEO', 'DOCUMENT']), size: z.coerce.number().int().min(1), mime: txt(3, 120) });
export const reviewSchema = z.object({ decision: z.enum(['VALIDATED', 'REVISION']), comment: z.string().trim().max(500).optional().default('') });
export const jobSchema = z.object({
  title: txt(3, 120), description: txt(20, 3000), skills: z.array(txt(1, 60)).min(1).max(8), deliverables: optTxt(300),
  budgetMin: z.coerce.number().int().min(0).max(1e8).default(0), budgetMax: z.coerce.number().int().min(0).max(1e8).default(0),
  deadline: optTxt(60), mode: z.enum(['À distance', 'Sur site', 'Mixte']).default('À distance'), location: optTxt(100),
  subtasks: z.array(txt(1, 200)).max(12).default([]), subtasksConfirmed: z.boolean().default(false),
}).refine((j) => !j.budgetMax || j.budgetMin <= j.budgetMax, { message: 'Le budget minimum dépasse le maximum.' })
  .refine((j) => !j.subtasks.length || j.subtasksConfirmed, { message: 'Validez la décomposition proposée par l’IA avant de publier.' });
export const jobStatusSchema = z.object({ status: z.enum(['PUBLISHED', 'CLOSED']) });
export const companySchema = z.object({ name: txt(2, 120), sector: optTxt(80), description: optTxt(600), city: optTxt(80) });
export const applySchema = z.object({ message: optTxt(500) });
export const appStatusSchema = z.object({ status: z.enum(['SHORTLISTED', 'ACCEPTED', 'REJECTED']) });
export const reportSchema = z.object({ targetType: z.enum(['JOB', 'RECOMMENDATION', 'USER', 'AD', 'EVALUATION']), targetId: txt(1, 64), reason: txt(5, 300) });
export const checkoutSchema = z.object({ acceptTerms: z.literal(true, { errorMap: () => ({ message: 'Vous devez accepter les conditions.' }) }) });
export const appealSchema = z.object({ reason: txt(10, 400) });
export const reasonSchema = z.object({ status: z.string().max(30), reason: txt(5, 300) });
export const decomposeSchema = z.object({ title: optTxt(120), description: txt(20, 3000), skills: z.array(txt(1, 60)).max(8).default([]) });
export const adSchema = z.object({
  advertiserName: txt(2, 120), advertiserCompanyId: z.string().max(60).optional().nullable(), name: txt(2, 100), title: txt(2, 60), text: txt(2, 140),
  destinationUrl: txt(8, 500), mediaRef: z.string().trim().max(500).optional().nullable().or(z.literal('')), ctaLabel: optTxt(30),
  placementIds: z.array(z.string().max(40)).min(1).max(5), startsAt: z.coerce.date(), endsAt: z.coerce.date(), frequencyCap: z.coerce.number().int().min(1).max(20).default(3), orderRef: z.string().trim().max(60).optional().nullable().or(z.literal('')),
}).refine((a) => a.startsAt <= a.endsAt, { message: 'La période est invalide : le début doit précéder la fin.' });
export const adActionSchema = z.object({ reason: z.string().trim().max(300).optional().default(''), confirmPayment: z.boolean().optional().default(false), orderRef: z.string().trim().max(60).optional() });
export const adEventSchema = z.object({ placement: txt(1, 40) });
export const adminLoginSchema = loginSchema;
