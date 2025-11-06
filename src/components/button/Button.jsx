import "./Button.css";

const Button = ({ children, onClick, type = "button", mt = "10px", variant = "primary", disabled }) => {
    return (
        <button
            className={`btn ${variant}`}
            onClick={onClick}
            type={type}
            disabled={disabled}
            style={{ marginTop: mt }}
        >
            {children}
        </button>
    );
};

export default Button;
