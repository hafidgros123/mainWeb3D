// One d20 roll: a whole number from 1 to 20.
// (dice_00.png is only the blank face shown before the first roll.)
export function rollDie() {
  return Math.floor(Math.random() * 20) + 1
}

// Rolls `count` dice and returns the individual values.
export function rollDice(count = 5) {
  return Array.from({ length: count }, rollDie)
}

// Rolls `count` dice so that every possible total (5 to 100 for five dice) is equally likely.
// The total is picked first, then split across the dice in a random way.
// `forcedTotal` is only for testing: it makes the dice add up to exactly that number.
export function rollDiceEven(count = 5, forcedTotal) {
  const MIN_FACE = 1
  const MAX_FACE = 20
  const min = count * MIN_FACE
  const max = count * MAX_FACE
  const random = min + Math.floor(Math.random() * (max - min + 1)) // each total has the same chance
  const target = forcedTotal === undefined ? random : Math.min(max, Math.max(min, forcedTotal))

  const dice = Array(count).fill(MIN_FACE)
  let remaining = target - min
  while (remaining > 0) {
    const i = Math.floor(Math.random() * count)
    if (dice[i] < MAX_FACE) {
      dice[i] += 1
      remaining -= 1
    }
  }
  return dice
}