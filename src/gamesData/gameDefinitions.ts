export interface GameDefinition {
  id: string
  number: string
  title: string
  description: string // the text shown on the glass card
  image: string // a path inside public/, for example '/gameImages/game1Cover.webp'; '' = empty placeholder
}

export const gameDefinitions: GameDefinition[] = [
  // description = the text shown on the glass card.  image = a picture for the card, for example '/games/game-one.webp'
  // (put the file in public/games/). While image is empty the card shows an empty placeholder.
  { id: 'game-one', number: '01', title: 'Game One', description: 'platform 2d game with quests and infinit dungeon system with scoreboard', image: '/gameImages/game1Cover.webp' },
  { id: 'game-two', number: '02', title: 'Game Two', description: 'just link to a 3dunreal engine game i made sice we cant put the game directly like for unity webGL', image: '/gameImages/game2Cover.webp' },
  { id: 'game-three', number: '03', title: 'Game Three', description: 'up down 2d game with quest and turn based system , infinit quest and related to the dice game in website , works fully on website page', image: '/gameImages/game3Cover.webp' },
]
