import "./Input.css";

const Input = ({ label, type = "text", name, value, onChange, placeholder, required }) => {
    return (
        <div className="input-wrapper">
            {label && <label>{label}</label>}
            <input
                type={type}
                name={name}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                required={required}
            />
        </div>
    );
};

export default Input;