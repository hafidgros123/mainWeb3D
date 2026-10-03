import ellenCharacter from '../../assets/character_transparent.webp'

function ChatBubbleButton({ onOpen }) {
  return (
    <button className="chat-launcher" type="button" onClick={onOpen} aria-label="Open Ellen chat">
      <img src={ellenCharacter} alt="Ellen" />
      <span>Chat with Small Ellen</span>
    </button>
  )
}

export default ChatBubbleButton
