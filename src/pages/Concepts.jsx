import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import './Concepts.css';

const Concepts = () => {
  const [concepts, setConcepts] = useState([]);
  const [selectedConceptId, setSelectedConceptId] = useState(null);
  const [formData, setFormData] = useState({ nombre: '', tipo: 'ingreso', periodo: 'diario' });

  const fetchConcepts = async () => {
    const { data, error } = await supabase
      .from('conceptos')               
      .select('*')
      .order('nombre', { ascending: true });

    if (error) console.error('Error fetching concepts:', error);
    else setConcepts(data);
  };

  useEffect(() => {
    fetchConcepts();
  }, []);

  useEffect(() => {
    if (selectedConceptId) {
      const concept = concepts.find(c => c.id === selectedConceptId);
      if (concept) setFormData(concept);
    } else {
      setFormData({ nombre: '', tipo: 'ingreso', periodo: 'diario' });
    }
  }, [selectedConceptId]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    const tipo = formData.tipo.toLowerCase();
    const periodo = formData.periodo.toLowerCase();
    const nombre = formData.nombre.trim();

    if (!nombre) return alert("El nombre es obligatorio");
        
    if (selectedConceptId) {
        const { data, error } = await supabase
        .from('conceptos')
        .update({ nombre, tipo, periodo })
        .eq('id', selectedConceptId);
        if (error) {
            console.error('Error updating concept:', error);
            alert(`Error al editar: ${error.message}`);
        } else {
            console.log('Concepto actualizado:', data);
        }
    } else {
        const { data, error } = await supabase
        .from('conceptos')
        .insert([{ nombre, tipo, periodo }]);
        
        if (error) {
        console.error('Error al insertar concepto:', error);
        alert(`Error al insertar: ${error.message}`);
        } else {
        console.log('Concepto insertado correctamente:', data);
        }
    }

    setSelectedConceptId(null);
    setFormData({ nombre: '', tipo: 'ingreso', periodo: 'diario' });
    fetchConcepts();
  };

  return (
    <div className="concepts-container">
        <div className="concepts-summary">
            <h2>Configuración de conceptos</h2>
            <div className="summary-box">
                <div className="summary-item total">
                <span>Total</span>
                <span>{concepts.length}</span>
                </div>
                <div className="summary-item ingreso">
                <span>Ingresos</span>
                <span>{concepts.filter(c => c.tipo === 'ingreso').length}</span>
                </div>
                <div className="summary-item egreso">
                <span>Egresos</span>
                <span>{concepts.filter(c => c.tipo === 'egreso').length}</span>
                </div>
            </div>
        </div>
        
        <div className="concepts-edit">
            <h3>Editar concepto</h3>
            <div className="edit-selector">
            <select
                value={selectedConceptId || ''}
                onChange={(e) => setSelectedConceptId(Number(e.target.value))}
            >
                <option value="">Selecciona un concepto</option>
                {concepts.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
            </select>
            </div>
        </div>

        <div className="concepts-form">
            <h3>{selectedConceptId ? 'Editar concepto' : 'Nuevo concepto'}</h3>
            <div className="form-group">
            <label>Nombre del concepto</label>
            <input type="text" name="nombre" value={formData.nombre} onChange={handleChange} />
            </div>
            <div className="form-group">
            <label>Tipo</label>
            <select name="tipo" value={formData.tipo} onChange={handleChange}>
                <option value="ingreso">Ingreso</option>
                <option value="egreso">Egreso</option>
            </select>
            </div>
            <div className="form-group">
            <label>Periodicidad</label>
            <select name="periodo" value={formData.periodo} onChange={handleChange}>
                <option value="diario">Diario</option>
                <option value="quincenal">Quincenal</option>
                <option value="mensual">Mensual</option>
            </select>
            </div>
            <div className="form-buttons">
                <button className="save-btn" onClick={handleSave}>Guardar</button>
                <button 
                className="new-btn" 
                onClick={() => {
                    setSelectedConceptId(null);
                    setFormData({ nombre: '', tipo: 'ingreso', periodo: 'diario' });
                }}
                >
                Nuevo
                </button>
            </div>
        </div>
    </div>
  );
};

export default Concepts;
