import { useRef, useState, useEffect } from 'react';
import './AvatarUpload.css';

interface AvatarUploadProps {
  currentAvatar?: string;
  onUpload: (avatarBase64: string) => void;
  userName?: string;
}

function AvatarUpload({ currentAvatar, onUpload, userName = 'U' }: AvatarUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | undefined>(currentAvatar);
  const [isUploading, setIsUploading] = useState(false);

  // Atualizar preview quando currentAvatar mudar
  useEffect(() => {
    setPreview(currentAvatar);
  }, [currentAvatar]);

  const getIniciais = (nome: string) => {
    const partes = nome.trim().split(/\s+/).filter(Boolean);
    if (partes.length >= 2) {
      return (partes[0][0] + partes[1][0]).toUpperCase();
    }
    const s = partes[0] || '';
    return s.length >= 2 ? s.substring(0, 2).toUpperCase() : (s[0] || 'U').toUpperCase();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione uma imagem válida.');
      return;
    }

    // Validar tamanho (máximo 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('A imagem deve ter no máximo 2MB.');
      return;
    }

    setIsUploading(true);

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setPreview(base64String);
      onUpload(base64String);
      setIsUploading(false);
    };
    reader.onerror = () => {
      alert('Erro ao ler a imagem. Tente novamente.');
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleRemove = () => {
    setPreview(undefined);
    onUpload('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="avatar-upload">
      <div className="avatar-preview" onClick={handleClick}>
        {preview ? (
          <img src={preview} alt="Avatar" />
        ) : (
          <span className="avatar-initials">{getIniciais(userName)}</span>
        )}
        {isUploading && (
          <div className="avatar-loading">
            <span>⏳</span>
          </div>
        )}
        <div className="avatar-overlay">
          <span className="avatar-upload-icon">📷</span>
          <span className="avatar-upload-text">Alterar</span>
        </div>
      </div>
      <div className="avatar-info">
        <p className="avatar-hint">
          Clique na foto para alterar. Formatos: JPG, PNG, GIF. Máximo: 2MB
        </p>
        {preview && (
          <button
            type="button"
            className="avatar-remove-btn"
            onClick={handleRemove}
            title="Remover foto"
          >
            🗑️ Remover
          </button>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
    </div>
  );
}

export default AvatarUpload;
