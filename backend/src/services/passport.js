/** Statut d'une compétence : déclarée -> démontrée (livrable envoyé) -> validée (validé par l'administration). */
export const skillStatusFrom = ({ validated, pending }) => (validated ? 'VALIDATED' : pending ? 'DEMONSTRATED' : 'DECLARED');
