import React from 'react';
import {Box, Text} from 'ink';

export function HelpPanel(): React.JSX.Element {
  return (
    <Box borderStyle="round" borderColor="blue" paddingX={2} flexDirection="column">
      <Text bold color="blue">
        AIDE
      </Text>
      <Text>
        <Text bold>Espace</Text> Mettre l’affichage en pause / reprendre
      </Text>
      <Text>
        <Text bold>O</Text> Ouvrir les options interactives
      </Text>
      <Text>
        <Text bold>P</Text> Chercher et ouvrir un preset MilkDrop
      </Text>
      <Text>
        <Text bold>V</Text> Ouvrir / fermer la fenêtre de visualisation
      </Text>
      <Text>
        <Text bold>N / B</Text> Preset suivant / précédent
      </Text>
      <Text>
        <Text bold>D</Text> Passer rapidement à la sortie audio suivante
      </Text>
      <Text>
        <Text bold>S</Text> Changer la réactivité des vumètres
      </Text>
      <Text>
        <Text bold>H</Text> Fermer cette aide
      </Text>
      <Text>
        <Text bold>Q / Échap</Text> Quitter proprement
      </Text>
    </Box>
  );
}
