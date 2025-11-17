import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { GestorConcepto } from '../../api/GestorConcepto';
import { GestorUsuario } from "../../api/GestorUsuario";
import '../../styles/Conceptos.css';

const Conceptos = () => { // COD004
  const gestorUsuario = new GestorUsuario(supabase);
  const gestorConceptos = new GestorConcepto(supabase, gestorUsuario);
  const [concepts, setConcepts] = useState([]);
  const [selectedConceptId, setSelectedConceptId] = useState(null);
  const [formData, setFormData] = useState({ nombre: '', tipo: 'ingreso', periodo: 'diario' });

  const fetchConcepts = async () => { // MCOD004-3
    try {
      const data = await gestorConceptos.obtenerConceptos();
      setConcepts(data || []);
    } catch (error) {
      console.error('Error fetching concepts:', error);
    }
  };

  useEffect(() => { // MCOD004-1 
    fetchConcepts();
  }, []);

  useEffect(() => { // MCOD004-2 
    if (selectedConceptId) {
      const concept = concepts.find(c => c.id === selectedConceptId);
      if (concept) setFormData(concept);
    } else {
      setFormData({ nombre: '', tipo: 'ingreso', periodo: 'diario' });
    }
  }, [selectedConceptId, concepts]);

  const handleChange = (e) => { // MCOD004-4 
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => { // MCOD004-5 
    const tipo = formData.tipo.toLowerCase();
    const periodo = formData.periodo.toLowerCase();
    const nombre = formData.nombre.trim();

    if (!nombre) return alert("El nombre es obligatorio");

    try {
      if (selectedConceptId) {
        await gestorConceptos.editarConcepto(selectedConceptId, { nombre, tipo, periodo });
        console.log('Concepto actualizado');
      } else {
        await gestorConceptos.crearConcepto({ nombre, tipo, periodo });
        console.log('Concepto insertado correctamente');
      }
      setSelectedConceptId(null);
      setFormData({ nombre: '', tipo: 'ingreso', periodo: 'diario' });
      fetchConcepts();
    } catch (error) {
      console.error('Error al guardar concepto:', error);
      alert(`Error: ${error.message}`);
    }
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
            onChange={(e) => setSelectedConceptId(e.target.value)}
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
        <div className="form-group-concepto">
          <label>Nombre del concepto</label>
          <input type="text" name="nombre" value={formData.nombre} onChange={handleChange} />
        </div>
        <div className="form-group-concepto">
          <label>Tipo</label>
          <select name="tipo" value={formData.tipo} onChange={handleChange}>
            <option value="ingreso">Ingreso</option>
            <option value="egreso">Egreso</option>
          </select>
        </div>
        <div className="form-group-concepto">
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
            className="new-btn-concept"
            onClick={() => {
              setSelectedConceptId(null);
              setFormData({ nombre: '', tipo: 'ingreso', periodo: 'diario' });
            }}
          >Nuevo</button>
        </div>
      </div>
    </div>
  );
};

export default Conceptos;
