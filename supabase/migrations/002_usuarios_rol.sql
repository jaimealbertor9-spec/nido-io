-- ============================================
-- MIGRACIÓN: Agregar ROL a tabla USUARIOS
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- 1. Agregar columna 'rol' a la tabla usuarios
ALTER TABLE public.usuarios
ADD COLUMN IF NOT EXISTS rol VARCHAR(20) DEFAULT NULL;

-- 2. Crear constraint CHECK para validar valores permitidos
-- (anfitrion, inquilino, o NULL para usuarios que no han seleccionado)
ALTER TABLE public.usuarios
ADD CONSTRAINT usuarios_rol_check 
CHECK (rol IS NULL OR rol IN ('anfitrion', 'inquilino'));

-- 3. Comentario descriptivo para documentación
COMMENT ON COLUMN public.usuarios.rol IS 
'Rol del usuario: anfitrion (publica propiedades), inquilino (busca propiedades), NULL (sin seleccionar)';

-- ============================================
-- RLS: Permitir al usuario actualizar su propio rol
-- ============================================

-- 4. Crear política para UPDATE del rol (onboarding)
-- El usuario solo puede actualizar su propia fila
CREATE POLICY "Usuarios pueden actualizar su propio rol"
ON public.usuarios
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 5. Asegurar que la política de SELECT existe
-- (permite al usuario leer su propio registro)
CREATE POLICY IF NOT EXISTS "Usuarios pueden ver su propio perfil"
ON public.usuarios
FOR SELECT
USING (auth.uid() = id);

-- ============================================
-- VERIFICACIÓN
-- ============================================
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns 
-- WHERE table_name = 'usuarios' AND column_name = 'rol';
