
export function rollDiceEven(count = 5) {
  const MIN_FACE = 0
  const MAX_FACE = 20
  const min = count * MIN_FACE
  const max = count * MAX_FACE
  const target = min + Math.floor(Math.random() * (max - min + 1)) // each total has the same chance

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