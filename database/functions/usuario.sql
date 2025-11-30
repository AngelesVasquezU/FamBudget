-- RPC: obtener_id_usuario
-- Objetivo:
--   Obtiene el ID interno del usuario en la tabla "usuarios" a partir de su
--   auth_id de Supabase Authentication.
--
-- Parámetros:
--   p_auth_id → ID de autenticación del usuario en Supabase Auth
--
-- Reglas:
--   - Retorna null si no existe un usuario con ese auth_id
--
-- Retorna:
--   ID interno del usuario en la tabla "usuarios"

CREATE OR REPLACE FUNCTION obtener_id_usuario(
  p_auth_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id
  FROM usuarios
  WHERE auth_id = p_auth_id;

  RETURN v_id;
END;
$$;

-- RPC: obtener_usuario
-- Objetivo:
--   Obtiene el registro completo de un usuario a partir de su auth_id
--   de Supabase Authentication.
--
-- Parámetros:
--   p_auth_id → ID de autenticación del usuario en Supabase Auth
--
-- Reglas:
--   - Retorna null si no existe un usuario con ese auth_id
--
-- Retorna:
--   Registro completo del usuario con todos sus campos

CREATE OR REPLACE FUNCTION obtener_usuario(
  p_auth_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_user JSONB;
BEGIN
  SELECT to_jsonb(u) INTO v_user
  FROM usuarios u
  WHERE u.auth_id = p_auth_id;

  RETURN v_user;
END;
$$;

-- RPC: obtener_usuarios_de_familia
-- Objetivo:
--   Lista todos los usuarios que pertenecen a una familia específica.
--
-- Parámetros:
--   p_familia_id → ID de la familia cuyos miembros se desean consultar
--
-- Reglas:
--   - Retorna array vacío si la familia no tiene miembros o no existe
--   - Solo incluye información básica de cada usuario (id, nombre, correo, rol)
--
-- Retorna:
--   Lista de usuarios miembros de la familia con información básica

CREATE OR REPLACE FUNCTION obtener_usuarios_de_familia(
  p_familia_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', u.id,
      'nombre', u.nombre,
      'correo', u.correo,
      'rol', u.rol
    )
  ) INTO v_result
  FROM usuarios u
  WHERE u.familia_id = p_familia_id;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- RPC: actualizar_usuario
-- Objetivo:
--   Actualiza el nombre y parentesco de un usuario específico.
--
-- Parámetros:
--   p_usuario_id → ID del usuario a actualizar
--   p_nombre     → Nuevo nombre del usuario
--   p_parentesco → Nuevo parentesco del usuario
--
-- Reglas:
--   - Los valores de nombre y parentesco se normalizan eliminando espacios
--   - Retorna null si el usuario no existe
--
-- Retorna:
--   Usuario actualizado con todos sus campos

CREATE OR REPLACE FUNCTION actualizar_usuario(
  p_usuario_id UUID,
  p_nombre TEXT,
  p_parentesco TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_user JSONB;
BEGIN
  UPDATE usuarios
  SET nombre = TRIM(p_nombre),
      parentesco = TRIM(p_parentesco)
  WHERE id = p_usuario_id
  RETURNING to_jsonb(usuarios) INTO v_user;

  RETURN v_user;
END;
$$;