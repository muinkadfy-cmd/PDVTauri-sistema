/**
 * Hook para formulários inteligentes com rascunho automático
 * Salva automaticamente no localStorage e restaura ao voltar
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { safeGet, safeSet, safeRemove } from '@/lib/storage';

const DRAFT_PREFIX = 'smart-form-draft:';
const DEBOUNCE_MS = 300;

interface UseSmartFormOptions<T> {
  /** Chave única para identificar o formulário (ex: 'clientes', 'produtos') */
  formKey: string;
  /** Valores iniciais do formulário */
  initialValues: T;
  /** Callback quando dados são salvos (opcional) */
  onSave?: (data: T) => void;
  /** Callback quando dados são restaurados (opcional) */
  onRestore?: (data: T) => void;
}

/**
 * Hook para formulários com rascunho automático
 */
export function useSmartForm<T extends Record<string, any>>({
  formKey,
  initialValues,
  onSave,
  onRestore
}: UseSmartFormOptions<T>) {
  const location = useLocation();
  const [formData, setFormData] = useState<T>(initialValues);
  const [hasDraft, setHasDraft] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialMountRef = useRef(true);

  // Chave única do rascunho (formKey + pathname para evitar conflitos)
  const draftKey = `${DRAFT_PREFIX}${formKey}:${location.pathname}`;

  // Carregar rascunho ao montar
  useEffect(() => {
    const draft = safeGet<T>(draftKey, null);
    if (draft.success && draft.data) {
      setFormData(draft.data);
      setHasDraft(true);
      if (onRestore) {
        onRestore(draft.data);
      }
    }
    isInitialMountRef.current = false;
  }, [formKey, location.pathname]);

  // Salvar rascunho automaticamente com debounce
  useEffect(() => {
    // Não salvar no primeiro render (após carregar rascunho)
    if (isInitialMountRef.current) {
      return;
    }

    // Limpar timer anterior
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Criar novo timer
    debounceTimerRef.current = setTimeout(() => {
      safeSet(draftKey, formData);
      setHasDraft(true);
      if (onSave) {
        onSave(formData);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [formData, draftKey, onSave]);

  // Função para atualizar dados do formulário
  const updateFormData = useCallback((updates: Partial<T> | ((prev: T) => T)) => {
    setFormData((prev) => {
      if (typeof updates === 'function') {
        return updates(prev);
      }
      return { ...prev, ...updates };
    });
  }, []);

  // Função para resetar formulário
  const resetForm = useCallback(() => {
    setFormData(initialValues);
    safeRemove(draftKey);
    setHasDraft(false);
  }, [initialValues, draftKey]);

  // Função para limpar rascunho
  const clearDraft = useCallback(() => {
    safeRemove(draftKey);
    setHasDraft(false);
  }, [draftKey]);

  // Função para salvar manualmente (sem debounce)
  const saveDraft = useCallback(() => {
    safeSet(draftKey, formData);
    setHasDraft(true);
    if (onSave) {
      onSave(formData);
    }
  }, [formData, draftKey, onSave]);

  return {
    formData,
    setFormData: updateFormData,
    resetForm,
    clearDraft,
    saveDraft,
    hasDraft
  };
}
