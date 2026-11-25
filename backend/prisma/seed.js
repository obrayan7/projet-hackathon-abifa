// Données de référence uniquement (aucun faux utilisateur) : catalogue, défis du catalogue, emplacements, premier administrateur.
import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { BANK } from '../src/services/aiFallback.js';
const prisma = new PrismaClient();
const SKILLS = [['HTML5 & CSS', 'Web'], ['JavaScript', 'Web'], ['React.js', 'Web'], ['Node.js', 'Web'], ['PostgreSQL', 'Données'], ['Excel', 'Données'], ['Python', 'Données'], ['Design graphique', 'Design'], ['Figma', 'Design'], ['Montage vidéo', 'Audiovisuel'], ['Photographie', 'Audiovisuel'], ['Électricité', 'Métiers'], ['Couture', 'Métiers'], ['Marketing digital', 'Commerce'], ['Vente', 'Commerce'], ['Flutter', 'Mobile']];
for (const [name, category] of SKILLS) await prisma.skill.upsert({ where: { name }, update: {}, create: { name, category } });
for (const [skill, list] of Object.entries(BANK)) {
  const s = await prisma.skill.findUnique({ where: { name: skill } });
  for (const [title, description, criteria, duration] of list)
    if (!(await prisma.challenge.findFirst({ where: { title, skillId: s.id, source: 'CATALOG' } }))) await prisma.challenge.create({ data: { title, description, criteria, duration, skillId: s.id, source: 'CATALOG', status: 'PUBLISHED' } });
}
for (const [id, name] of [['dashboard-jeune', 'Carte sponsorisée du tableau de bord jeune'], ['fil-accueil', 'Bloc du fil d’accueil'], ['partenaires', 'Espace dédié aux partenaires']]) await prisma.adPlacement.upsert({ where: { id }, update: {}, create: { id, name } });
if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
  const email = process.env.ADMIN_EMAIL.toLowerCase();
  await prisma.user.upsert({ where: { email }, update: {}, create: { email, name: 'Administrateur', role: 'ADMIN', passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD, 12) } });
  console.log('Administrateur prêt :', email);
}
console.log('Seed terminé.');
await prisma.$disconnect();
