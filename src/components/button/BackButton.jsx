import { useNavigate } from 'react-router-dom';
import './BackButton.css';
import { FaArrowLeft } from 'react-icons/fa';

const BackButton = ({ to = -1 }) => {
    const navigate = useNavigate();

    return (
        <button className="back-btn" onClick={() => navigate(to)}>
            <FaArrowLeft className="back-btn-icon" />
        </button>
    );
};

export default BackButton;
