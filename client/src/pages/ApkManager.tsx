import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { 
  Upload, 
  Download, 
  Trash2, 
  Copy, 
  Check, 
  Loader2, 
  FileArchive,
  Link,
  ExternalLink,
  Star,
  Clock,
  HardDrive,
  BarChart3,
  RefreshCw,
  AlertTriangle,
  Zap
} from "lucide-react";

const API_BASE_URL = "https://youngmoney-api-railway-production-5bf3.up.railway.app";
const PERMANENT_DOWNLOAD_URL = `${API_BASE_URL}/api/v1/apk/download.php`;

interface ApkInfo {
  id?: number;
  file_name: string;
  original_name?: string;
  version?: string;
  description?: string;
  file_size: number;
  file_size_formatted: string;
  download_url: string;
  direct_url?: string;
  download_count?: number;
  is_active?: boolean;
  uploaded_at: string;
}

export default function ApkManager() {
  const [apks, setApks] = useState<ApkInfo[]>([]);
  const [activeApk, setActiveApk] = useState<ApkInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [version, setVersion] = useState("");
  const [description, setDescription] = useState("");

  // tRPC para sincronizar com as configurações de atualização do app
  const { data: allSettings, refetch: refetchSettings } = trpc.settings.list.useQuery();
  const syncAppUpdate = trpc.settings.syncAppUpdate.useMutation({
    onSuccess: () => {
      refetchSettings();
    },
  });

  // Obter configurações atuais de atualização
  const getCurrentUpdateSettings = useCallback(() => {
    const defaults = {
      app_update_enabled: "0",
      app_update_min_version: "1.0.0",
      app_update_download_url: "",
      app_update_secondary_url: "",
      app_update_force: "0",
      app_update_release_notes: "",
    };
    if (allSettings) {
      allSettings.forEach((setting: any) => {
        if (setting.setting_key in defaults) {
          (defaults as any)[setting.setting_key] = setting.setting_value;
        }
      });
    }
    return defaults;
  }, [allSettings]);

  const fetchApks = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/v1/apk/list.php`);
      const data = await response.json();
      
      if (data.success) {
        setApks(data.data.apks || []);
        setActiveApk(data.data.active || null);
      }
    } catch (error) {
      console.error("Erro ao buscar APKs:", error);
      toast.error("Erro ao carregar lista de APKs");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApks();
  }, [fetchApks]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.apk')) {
        toast.error("Apenas arquivos .apk são permitidos");
        return;
      }
      setSelectedFile(file);
    }
  };

  /**
   * Sincroniza o link do APK ativo com as configurações de atualização do app.
   * Preenche automaticamente a URL de download (principal ou secundária) e sincroniza com o PHP.
   */
  const syncApkLinkToUpdateSettings = async (apkUrl: string, asSecondary: boolean = false) => {
    setIsSyncing(true);
    try {
      const current = getCurrentUpdateSettings();
      
      const newSettings = {
        ...current,
        // Se asSecondary, preenche a URL secundária; senão, preenche a principal
        ...(asSecondary 
          ? { app_update_secondary_url: apkUrl }
          : { app_update_download_url: apkUrl }
        ),
      };

      const result = await syncAppUpdate.mutateAsync(newSettings);

      if (result.php_sync?.success === false) {
        toast.warning("Link salvo no banco, mas houve erro ao sincronizar com a API PHP.");
      } else {
        toast.success(
          asSecondary 
            ? "Link do APK definido como URL secundária de atualização!" 
            : "Link do APK definido como URL principal de atualização!"
        );
      }
    } catch (error) {
      console.error("Erro ao sincronizar link:", error);
      toast.error("Erro ao sincronizar link com configurações de atualização");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Selecione um arquivo APK");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('apk', selectedFile);
      formData.append('version', version || 'unknown');
      formData.append('description', description || '');

      const xhr = new XMLHttpRequest();
      
      const uploadPromise = new Promise<any>((resolve, reject) => {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            setUploadProgress(percent);
          }
        });

        xhr.addEventListener('load', () => {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch {
            reject(new Error('Resposta inválida do servidor'));
          }
        });

        xhr.addEventListener('error', () => reject(new Error('Erro de rede')));
        xhr.addEventListener('abort', () => reject(new Error('Upload cancelado')));

        xhr.open('POST', `${API_BASE_URL}/api/v1/apk/upload.php`);
        xhr.send(formData);
      });

      const result = await uploadPromise;

      if (result.success) {
        toast.success("APK enviado com sucesso!");
        setSelectedFile(null);
        setVersion("");
        setDescription("");
        // Reset file input
        const fileInput = document.getElementById('apk-file-input') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        
        await fetchApks();

        // Auto-sincronizar: o APK enviado se torna ativo automaticamente,
        // então atualizar a URL de download nas configurações de atualização
        toast.info("Sincronizando link do APK com configurações de atualização...");
        await syncApkLinkToUpdateSettings(PERMANENT_DOWNLOAD_URL, true);
      } else {
        toast.error(result.error || "Erro ao enviar APK");
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Erro ao enviar APK");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async (apk: ApkInfo) => {
    if (!confirm(`Tem certeza que deseja excluir o APK "${apk.file_name}"?`)) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/apk/delete.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: apk.id, file_name: apk.file_name }),
      });
      const data = await response.json();

      if (data.success) {
        toast.success("APK excluído com sucesso");
        await fetchApks();
      } else {
        toast.error(data.error || "Erro ao excluir APK");
      }
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Erro ao excluir APK");
    }
  };

  const handleActivate = async (apk: ApkInfo) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/apk/activate.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: apk.id }),
      });
      const data = await response.json();

      if (data.success) {
        toast.success("APK ativado como download principal");
        await fetchApks();

        // Auto-sincronizar: quando ativar um APK, atualizar a URL de download
        // nas configurações de atualização do app automaticamente
        toast.info("Sincronizando link com configurações de atualização...");
        await syncApkLinkToUpdateSettings(PERMANENT_DOWNLOAD_URL, true);
      } else {
        toast.error(data.error || "Erro ao ativar APK");
      }
    } catch (error) {
      console.error("Activate error:", error);
      toast.error("Erro ao ativar APK");
    }
  };

  const copyToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      toast.success("Link copiado!");
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedUrl(url);
      toast.success("Link copiado!");
      setTimeout(() => setCopiedUrl(null), 2000);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('pt-BR');
    } catch {
      return dateStr;
    }
  };

  // Verificar se o link do APK já está configurado nas settings de atualização
  const currentSettings = getCurrentUpdateSettings();
  const isLinkAlreadySynced = 
    currentSettings.app_update_download_url === PERMANENT_DOWNLOAD_URL ||
    currentSettings.app_update_secondary_url === PERMANENT_DOWNLOAD_URL;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <FileArchive className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Gerenciador de APK</h1>
            <p className="text-muted-foreground">Carregando...</p>
          </div>
        </div>
        <div className="grid gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-64" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileArchive className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Gerenciador de APK</h1>
            <p className="text-muted-foreground">
              Faça upload do APK e gere links diretos para download
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={fetchApks}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* APK Ativo - Link Direto */}
      {activeApk && (
        <Card className="border-green-500 bg-green-50/50 dark:bg-green-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-green-600" />
              APK Ativo - Link Direto
            </CardTitle>
            <CardDescription>
              Este é o link direto do APK que está ativo para download
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="bg-green-600">Ativo</Badge>
              <span className="font-medium">{activeApk.file_name}</span>
              {activeApk.version && activeApk.version !== 'unknown' && (
                <Badge variant="outline">v{activeApk.version}</Badge>
              )}
              <Badge variant="secondary">{activeApk.file_size_formatted}</Badge>
              {activeApk.download_count !== undefined && (
                <Badge variant="secondary">
                  <Download className="h-3 w-3 mr-1" />
                  {activeApk.download_count} downloads
                </Badge>
              )}
            </div>

            {/* Link de Download Direto */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Link className="h-4 w-4" />
                Link de Download Direto (API)
              </Label>
              <div className="flex gap-2">
                <Input 
                  value={activeApk.download_url} 
                  readOnly 
                  className="font-mono text-sm bg-[#11161f] dark:bg-gray-900"
                />
                <Button
                  variant={copiedUrl === activeApk.download_url ? "default" : "outline"}
                  size="icon"
                  onClick={() => copyToClipboard(activeApk.download_url)}
                >
                  {copiedUrl === activeApk.download_url ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => window.open(activeApk.download_url, "_blank")}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Link sem parâmetro (sempre baixa o mais recente) */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Link className="h-4 w-4" />
                Link Permanente (sempre baixa o APK ativo)
              </Label>
              <div className="flex gap-2">
                <Input 
                  value={PERMANENT_DOWNLOAD_URL} 
                  readOnly 
                  className="font-mono text-sm bg-[#11161f] dark:bg-gray-900"
                />
                <Button
                  variant={copiedUrl === PERMANENT_DOWNLOAD_URL ? "default" : "outline"}
                  size="icon"
                  onClick={() => copyToClipboard(PERMANENT_DOWNLOAD_URL)}
                >
                  {copiedUrl === PERMANENT_DOWNLOAD_URL ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => window.open(PERMANENT_DOWNLOAD_URL, "_blank")}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Use este link no app - ele sempre aponta para o APK ativo mais recente
              </p>
            </div>

            {/* Botão de sincronização com App Update */}
            <div className="border-t pt-4 mt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-medium">Sincronização com Atualização do App</span>
                  {isLinkAlreadySynced && (
                    <Badge variant="default" className="bg-green-600 text-xs">
                      <Check className="h-3 w-3 mr-1" />
                      Sincronizado
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isSyncing}
                    onClick={() => syncApkLinkToUpdateSettings(PERMANENT_DOWNLOAD_URL, false)}
                  >
                    {isSyncing ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <Zap className="h-3 w-3 mr-1" />
                    )}
                    Usar como URL Principal
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isSyncing}
                    onClick={() => syncApkLinkToUpdateSettings(PERMANENT_DOWNLOAD_URL, true)}
                  >
                    {isSyncing ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <Zap className="h-3 w-3 mr-1" />
                    )}
                    Usar como URL Secundária
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Ao clicar, o link permanente do APK será automaticamente definido como URL de download 
                nas configurações de "Atualização do App" e sincronizado com a API PHP.
              </p>
              {isLinkAlreadySynced && (
                <div className="mt-2 text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  O link permanente já está configurado como URL de atualização
                  {currentSettings.app_update_download_url === PERMANENT_DOWNLOAD_URL && " (Principal)"}
                  {currentSettings.app_update_secondary_url === PERMANENT_DOWNLOAD_URL && " (Secundária)"}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload de APK */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload de APK
          </CardTitle>
          <CardDescription>
            Envie um novo arquivo APK para gerar o link direto de download
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* File Input */}
          <div className="space-y-2">
            <Label htmlFor="apk-file-input">Arquivo APK</Label>
            <div className="flex gap-2">
              <Input
                id="apk-file-input"
                type="file"
                accept=".apk"
                onChange={handleFileSelect}
                disabled={isUploading}
                className="flex-1"
              />
            </div>
            {selectedFile && (
              <p className="text-sm text-muted-foreground">
                Arquivo selecionado: <strong>{selectedFile.name}</strong> ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
              </p>
            )}
          </div>

          {/* Version and Description */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="apk-version">Versão</Label>
              <Input
                id="apk-version"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="Ex: 44.0, 2.1.0"
                disabled={isUploading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apk-description">Descrição (opcional)</Label>
              <Input
                id="apk-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Correção de bugs, novos recursos..."
                disabled={isUploading}
              />
            </div>
          </div>

          {/* Upload Progress */}
          {isUploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Enviando...</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} />
            </div>
          )}

          {/* Upload Button */}
          <Button 
            onClick={handleUpload} 
            disabled={!selectedFile || isUploading}
            size="lg"
            className="w-full"
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            {isUploading ? `Enviando... ${uploadProgress}%` : "Enviar APK e Gerar Link"}
          </Button>

          {/* Info */}
          <div className="bg-[#132033] border border-blue-200 rounded-lg p-4 dark:bg-blue-950/20 dark:border-blue-800">
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Como funciona:</h4>
            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
              <li>1. Selecione o arquivo APK do seu computador</li>
              <li>2. Informe a versão do app (opcional)</li>
              <li>3. Clique em "Enviar APK e Gerar Link"</li>
              <li>4. O link direto será gerado automaticamente</li>
              <li>5. O APK enviado se torna o download ativo automaticamente</li>
              <li>6. O link permanente sempre aponta para o APK ativo</li>
              <li>7. <strong>O link é automaticamente sincronizado com as configurações de atualização do app</strong></li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Lista de APKs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            APKs Enviados ({apks.length})
          </CardTitle>
          <CardDescription>
            Histórico de todos os APKs enviados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {apks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileArchive className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum APK enviado ainda</p>
              <p className="text-sm">Faça upload do primeiro APK acima</p>
            </div>
          ) : (
            <div className="space-y-4">
              {apks.map((apk, index) => (
                <div 
                  key={apk.id || index} 
                  className={`border rounded-lg p-4 space-y-3 ${
                    apk.is_active 
                      ? 'border-green-500 bg-green-50/30 dark:bg-green-950/10' 
                      : 'border-white/8 dark:border-gray-800'
                  }`}
                >
                  {/* Header do APK */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <FileArchive className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium">{apk.file_name}</span>
                      {apk.is_active && (
                        <Badge variant="default" className="bg-green-600">Ativo</Badge>
                      )}
                      {apk.version && apk.version !== 'unknown' && (
                        <Badge variant="outline">v{apk.version}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {!apk.is_active && apk.id && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleActivate(apk)}
                        >
                          <Star className="h-3 w-3 mr-1" />
                          Ativar
                        </Button>
                      )}
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => handleDelete(apk)}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Excluir
                      </Button>
                    </div>
                  </div>

                  {/* Info do APK */}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      <HardDrive className="h-3 w-3" />
                      {apk.file_size_formatted}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(apk.uploaded_at)}
                    </span>
                    {apk.download_count !== undefined && (
                      <span className="flex items-center gap-1">
                        <Download className="h-3 w-3" />
                        {apk.download_count} downloads
                      </span>
                    )}
                  </div>

                  {apk.description && (
                    <p className="text-sm text-muted-foreground">{apk.description}</p>
                  )}

                  {/* Link de Download */}
                  <div className="flex gap-2">
                    <Input 
                      value={apk.download_url} 
                      readOnly 
                      className="font-mono text-xs bg-[#11161f] dark:bg-gray-900"
                    />
                    <Button
                      variant={copiedUrl === apk.download_url ? "default" : "outline"}
                      size="icon"
                      onClick={() => copyToClipboard(apk.download_url)}
                    >
                      {copiedUrl === apk.download_url ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => window.open(apk.download_url, "_blank")}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Aviso sobre persistência */}
      <Card className="border-amber-300 bg-amber-50/50 dark:bg-amber-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
            <AlertTriangle className="h-5 w-5" />
            Aviso Importante
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Os arquivos APK são armazenados no servidor Railway. Em caso de redeploy do serviço, 
            os arquivos podem ser perdidos (Railway usa armazenamento efêmero). 
            Recomenda-se fazer upload novamente do APK após cada deploy.
            O <strong>link permanente</strong> ({PERMANENT_DOWNLOAD_URL}) 
            sempre apontará para o APK ativo mais recente.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
