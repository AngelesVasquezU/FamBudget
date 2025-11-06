import "./Button.css";

const Button = ({ children, onClick, type = "button", variant = "primary", disabled }) => {
    return (
        <button
            className={`btn ${variant}`}
            onClick={onClick}
            type={type}
            disabled={disabled}
        >
            {children}
        </button>
    );
};

export default Button;
