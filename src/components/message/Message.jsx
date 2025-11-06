import './Message.css';

const Message = ({ type = "info", children }) => {
    return (
        <div className={`app-message ${type}`}>
            {children}
        </div>
    );
};

export default Message;
