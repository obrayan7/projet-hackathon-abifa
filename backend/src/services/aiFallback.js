// Réponse de secours (règles simples) utilisée seulement si le fournisseur IA est absent ou en panne. Marquée fallback:true.
export const BANK = {
  'Design graphique': [['Affiche pour un événement local', 'Créez une affiche pour un concert, une foire ou une fête de quartier : titre lisible, hiérarchie visuelle, informations pratiques.', ['Lisibilité du message', 'Composition et couleurs', 'Originalité', 'Informations complètes'], '3 h'], ['Logo pour un petit commerce', 'Concevez un logo simple et facile à décliner pour une boutique de quartier.', ['Simplicité', 'Lisibilité en petit format', 'Cohérence des couleurs'], '2 h']],
  'Électricité': [['Schéma d’une installation de salon', 'Réalisez le schéma (ou une photo commentée) d’une installation de salon : prises, éclairage, protections.', ['Respect des règles de sécurité', 'Clarté du schéma', 'Choix du matériel'], '2 h'], ['Contrôle d’un tableau électrique', 'Filmez ou photographiez le contrôle d’un tableau en expliquant chaque étape.', ['Sécurité', 'Méthode', 'Explications'], '1 h']],
  'HTML5 & CSS': [['Page d’accueil responsive', 'Réalisez une page d’accueil qui s’adapte au mobile.', ['Structure sémantique', 'Affichage mobile', 'Accessibilité'], '2 h']],
  'Couture': [['Pièce sur mesure en wax', 'Présentez une pièce réalisée sur mesure, avec des photos de chaque étape.', ['Finition', 'Respect des mesures', 'Créativité'], '1 jour']],
  'Excel': [['Nettoyer un tableau de ventes', 'Corrigez les doublons et erreurs d’un tableau, puis ajoutez un total par produit.', ['Exactitude', 'Méthode', 'Présentation'], '2 h']],
};
export const bank = (skill) => (BANK[skill] || [[`Réalisation pratique : ${skill}`, `Réalisez un petit projet qui montre votre maîtrise de « ${skill} », puis déposez une preuve.`, ['Qualité du résultat', 'Respect de la consigne', 'Clarté de la présentation'], '2 h']])
  .map((c) => ({ skill, title: c[0], description: c[1], criteria: c[2], duration: c[3] }));
export const RULES = [[/affiche|flyer|logo|graphi|canva|photoshop|illustrator|design/i, 'Design graphique', 'Graphiste'], [/html|css|site (web|internet)/i, 'HTML5 & CSS', 'Développeur web'], [/javascript|\bjs\b/i, 'JavaScript', 'Développeur web'], [/react/i, 'React.js', 'Développeur web'], [/node|\bapi\b/i, 'Node.js', 'Développeur web'], [/excel|tableur/i, 'Excel', 'Assistant en gestion de données'], [/python/i, 'Python', 'Data analyst'], [/vid[ée]o|montage|capcut/i, 'Montage vidéo', 'Monteur vidéo'], [/photo/i, 'Photographie', 'Photographe'], [/[ée]lectric|c[âa]blage/i, 'Électricité', 'Électricien(ne)'], [/couture|couturi|stylisme|\bwax\b|tissu/i, 'Couture', 'Couturier(ère)'], [/marketing|r[ée]seaux sociaux|community/i, 'Marketing digital', 'Community manager'], [/vente|vendre|commerc/i, 'Vente', 'Commercial(e)']];
export function fallbackDiscover(text) {
  const y = +((text.match(/(\d+)\s*ans?/i) || [])[1] || 0);
  const skills = RULES.filter((r) => r[0].test(text)).map((r) => ({ name: r[1], level: Math.min(85, 50 + Math.min(30, y * 6)), evidence: 'Mentionné dans votre présentation' }));
  const titre = (RULES.find((r) => r[0].test(text)) || [0, 0, 'Freelance polyvalent'])[2];
  return { profile: { titre, bio: `${titre}${skills.length ? ' spécialisé(e) en ' + skills.map((s) => s.name).join(', ') : ''}. ${text.split(/[.!?]\s/)[0].slice(0, 180)}.` }, skills, challenges: skills.flatMap((s) => bank(s.name)),
    questions: skills.length ? [] : ['Quels outils ou matériaux utilisez-vous ?', 'Quelles réalisations pouvez-vous décrire ?'] };
}
export const fallbackDecompose = (skills) => ({ subtasks: [...skills.map((s) => `Réaliser la partie « ${s} »`), 'Tester et corriger', 'Livrer et présenter à l’entreprise'] });
