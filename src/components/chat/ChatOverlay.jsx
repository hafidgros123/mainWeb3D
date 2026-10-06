import { useState } from 'react'
import { selectSecretThemeUnlocked, useProgression } from '../../store/progressionStore'
import ChatBubbleButton from './ChatBubbleButton'
import ChatWindow from './ChatWindow'

function ChatOverlay({ theme, onThemeChange }) {
  const [isOpen, setIsOpen] = useState(false)
  const secretThemeUnlocked = useProgression(selectSecretThemeUnlocked)
  const unlockSecretTheme = useProgression((state) => state.unlockSecretTheme)

  return (
    <aside className={`chat-overlay${isOpen ? ' chat-open' : ''}`}>
      <div className="chat-theme-controls">
        <div className="chat-theme-picker" role="group" aria-label="Background themes">
          <button className="chat-theme-swatch" type="button" data-theme="blue" aria-label="Blue background" aria-pressed={theme === 'blue'} onClick={() => onThemeChange('blue')} />
          <button className="chat-theme-swatch" type="button" data-theme="light-blue" aria-label="Light blue background" aria-pressed={theme === 'light-blue'} onClick={() => onThemeChange('light-blue')} />
          <button className="chat-theme-swatch" type="button" data-theme="crimson" aria-label="Crimson background" aria-pressed={theme === 'crimson'} onClick={() => onThemeChange('crimson')} />
          <button className="chat-theme-swatch" type="button" data-theme="gold" aria-label="Gold background" aria-pressed={theme === 'gold'} onClick={() => onThemeChange('gold')} />
          <button className="chat-theme-swatch" type="button" data-theme="jade" aria-label="Jade background" aria-pressed={theme === 'jade'} onClick={() => onThemeChange('jade')} />
          <button
            className={`chat-theme-swatch chat-theme-swatch--secret${secretThemeUnlocked ? '' : ' is-locked'}`}
            type="button"
            data-theme="secret"
            aria-label={secretThemeUnlocked ? 'Secret background' : 'Secret background locked. Finish all three games to unlock.'}
            aria-pressed={theme === 'secret'}
            disabled={!secretThemeUnlocked}
            title={secretThemeUnlocked ? 'Secret background' : 'Finish all three games to unlock the secret theme'}
            onClick={() => onThemeChange('secret')}
          />
        </div>
        {!secretThemeUnlocked && (
          <span className="chat-theme-lock-hint">Finish all three games to unlock the secret theme</span>
        )}
      </div>
      {isOpen ? <ChatWindow onClose={() => setIsOpen(false)} onUnlockTheme={unlockSecretTheme} /> : <ChatBubbleButton onOpen={() => setIsOpen(true)} />}
    </aside>
  )
}

export default ChatOverlay
