import './ChatMessages.css'
import ellenPortrait from './assets/hey ellen nom nom.png'
import userPortrait from './assets/user.jpg'

function ChatMessages({ chatMessages }) {
  return (
    <div className="chat-messages">
      {chatMessages.map((msg) => (
        <div
          key={msg.id}
          className={`chat-message ${msg.sender === 'ellenBot' ? 'bot' : 'user'}`}
        >
          {msg.sender === 'ellenBot' && (
            <img className="message-avatar" src={ellenPortrait} alt="Ellen" />
          )}
          <div className="message-content">
            <div className="message-sender">{msg.sender}</div>
            <div className="message-bubble">{msg.message}</div>
          </div>
          {msg.sender !== 'ellenBot' && (
            <img className="message-avatar" src={userPortrait} alt="You" />
          )}
        </div>
      ))}
    </div>
  )
}

export default ChatMessages