import { supabase } from "./supabaseClient";
import { GestorUsuario } from "../api/GestorUsuario";
import { GestorMetas } from "../api/GestorMeta";
import { GestorMovimientos } from "../api/GestorMovimientos";
import { GestorConceptos } from "../api/GestorConceptos";
import { GestorAuth } from "../api/GestorAuth";
import { GestorFamilia } from "../api/GestorFamilia";

const gestorAuth = new GestorAuth(supabase);
const gestorUsuario = new GestorUsuario(supabase);
const gestorFamilia = new GestorFamilia(supabase);
const gestorMetas = new GestorMetas(supabase, gestorUsuario);
const gestorConceptos = new GestorConceptos(supabase, gestorUsuario);
const gestorMovimientos = new GestorMovimientos(supabase, gestorMetas, gestorUsuario);

export const providers = {
    gestorAuth,
    gestorUsuario,
    gestorMetas,
    gestorConceptos,
    gestorMovimientos,
    gestorFamilia
};
