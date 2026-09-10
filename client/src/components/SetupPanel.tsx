import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  TextField,
  Typography,
  type SelectChangeEvent,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import SearchIcon from '@mui/icons-material/Search';
import {
  deleteDocument,
  getConfig,
  listDocuments,
  saveConfig,
  searchDocuments,
  uploadDocuments,
} from '@/api';
import type { ConfigStatus, DocType, DocumentMeta, Provider, SearchResult } from '@/types';
import { FormBar, FormRow, ResultCard, SectionPaper, SetupStack } from './SetupPanel.style';

interface Props {
  onConfigured?: () => void;
}

const DOC_TYPE_COLOR: Record<DocType, 'primary' | 'secondary'> = {
  policy: 'primary',
  ticket: 'secondary',
};

export function SetupPanel({ onConfigured }: Props) {
  const [config, setConfig] = useState<ConfigStatus | null>(null);
  const [provider, setProvider] = useState<Provider>('openai');
  const [apiKey, setApiKey] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [docType, setDocType] = useState<DocType>('policy');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    getConfig().then(setConfig).catch(() => setConfig({ configured: false }));
    refreshDocuments();
  }, []);

  function refreshDocuments() {
    listDocuments()
      .then((res) => setDocuments(res.documents))
      .catch(() => setDocuments([]));
  }

  async function handleSaveKey(e: React.FormEvent) {
    e.preventDefault();
    setSavingKey(true);
    setKeyError(null);
    try {
      const status = await saveConfig(provider, apiKey);
      setConfig(status);
      setApiKey('');
      onConfigured?.();
    } catch (err) {
      setKeyError(err instanceof Error ? err.message : 'Failed to save key');
    } finally {
      setSavingKey(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (!files.length) return;

    setUploading(true);
    setUploadError(null);
    try {
      await uploadDocuments(files, docType);
      refreshDocuments();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleDelete(id: string) {
    await deleteDocument(id);
    refreshDocuments();
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await searchDocuments(query);
      setResults(res.results);
    } catch (err) {
      setResults(null);
      setUploadError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  }

  return (
    <SetupStack>
      <SectionPaper elevation={1}>
        <Typography variant="subtitle1" gutterBottom>
          1. LLM provider
        </Typography>
        {config?.configured ? (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Using <strong>{config.provider}</strong> ({config.maskedKey}). Save a new key below to
            replace it.
          </Typography>
        ) : (
          <Typography variant="body2" color="warning.main" sx={{ mb: 2 }}>
            No provider configured yet.
          </Typography>
        )}

        <FormBar onSubmit={handleSaveKey}>
          <Select
            value={provider}
            onChange={(e: SelectChangeEvent) => setProvider(e.target.value as Provider)}
          >
            <MenuItem value="openai">OpenAI</MenuItem>
            <MenuItem value="anthropic">Anthropic</MenuItem>
          </Select>
          <TextField
            type="password"
            placeholder="API key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            required
            sx={{ flex: 1, minWidth: 200 }}
          />
          <Button type="submit" variant="contained" disabled={savingKey}>
            {savingKey ? 'Saving…' : 'Save key'}
          </Button>
        </FormBar>
        {keyError && (
          <Alert severity="error" variant="outlined" sx={{ mt: 2 }}>
            {keyError}
          </Alert>
        )}
      </SectionPaper>

      <SectionPaper elevation={1}>
        <Typography variant="subtitle1" gutterBottom>
          2. Company policy &amp; past tickets
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Upload .txt, .md, or .pdf files. Each is chunked and embedded so the agent can retrieve
          relevant passages when answering.
        </Typography>

        <FormRow>
          <Select value={docType} onChange={(e: SelectChangeEvent) => setDocType(e.target.value as DocType)}>
            <MenuItem value="policy">Policy document</MenuItem>
            <MenuItem value="ticket">Past ticket / Q&amp;A</MenuItem>
          </Select>
          <Button component="label" variant="outlined" startIcon={<UploadFileIcon />} disabled={uploading}>
            Upload files
            <input type="file" multiple hidden accept=".txt,.md,.pdf" onChange={handleUpload} />
          </Button>
          {uploading && <CircularProgress size={20} thickness={6} />}
        </FormRow>
        {uploadError && (
          <Alert severity="error" variant="outlined" sx={{ mt: 2 }}>
            {uploadError}
          </Alert>
        )}

        <List sx={{ mt: 1 }}>
          {documents.map((doc) => (
            <ListItem
              key={doc.id}
              secondaryAction={
                <IconButton edge="end" aria-label={`Remove ${doc.filename}`} onClick={() => handleDelete(doc.id)}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              }
              sx={{ borderRadius: 2, mb: 0.5, backgroundColor: 'action.hover' }}
            >
              <Chip label={doc.docType} size="small" color={DOC_TYPE_COLOR[doc.docType]} sx={{ mr: 1.5 }} />
              <ListItemText primary={doc.filename} secondary={`${doc.chunkCount} chunks`} />
            </ListItem>
          ))}
          {documents.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No documents uploaded yet.
            </Typography>
          )}
        </List>
      </SectionPaper>

      <SectionPaper elevation={1}>
        <Typography variant="subtitle1" gutterBottom>
          3. Test retrieval
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Search the ingested data directly (no LLM call) to sanity-check it.
        </Typography>

        <FormBar onSubmit={handleSearch}>
          <TextField
            placeholder="e.g. what is the refund window?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            sx={{ flex: 1, minWidth: 200 }}
          />
          <Button type="submit" variant="contained" startIcon={<SearchIcon />} disabled={searching}>
            {searching ? 'Searching…' : 'Search'}
          </Button>
        </FormBar>

        {results && (
          <SetupStack sx={{ gap: 1.5, mt: 2 }}>
            {results.map((r, i) => (
              <ResultCard key={i} elevation={0}>
                <FormRow sx={{ mb: 0.5 }}>
                  <Chip label={r.docType} size="small" color={DOC_TYPE_COLOR[r.docType]} />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {r.filename}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    score {r.score.toFixed(3)}
                  </Typography>
                </FormRow>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {r.text}
                </Typography>
              </ResultCard>
            ))}
            {results.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No matches.
              </Typography>
            )}
          </SetupStack>
        )}
      </SectionPaper>
    </SetupStack>
  );
}
