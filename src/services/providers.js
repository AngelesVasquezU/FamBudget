import { supabase } from "./supabaseClient";
import { GestorUsuario } from "../api/GestorUsuario";
import { GestorMetas } from "../api/GestorMeta";
import { GestorMovimiento } from "../api/GestorMovimiento";
import { GestorConcepto } from "../api/GestorConcepto";

const gestorUsuario = new GestorUsuario(supabase);
const gestorMetas = new GestorMetas(supabase);
const gestorConceptos = new GestorConcepto(supabase, gestorUsuario);
const gestorMovimientos = new GestorMovimiento(supabase, gestorMetas, gestorUsuario);

export const container = {
    gestorUsuario,
    gestorMetas,
    gestorConceptos,
    gestorMovimientos
};
