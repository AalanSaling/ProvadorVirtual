// src/i18n/translations.ts

export type LanguageCode = 'pt' | 'es';

export interface Translations {
  // Navigation
  tryOnTab: string;
  catalogTab: string;
  adminTab: string;

  // Common
  save: string;
  cancel: string;
  close: string;
  confirm: string;
  delete: string;
  edit: string;
  add: string;
  back: string;
  all: string;
  inStock: string;
  outOfStock: string;
  available: string;
  units: string;
  search: string;
  language: string;
  portuguese: string;
  spanish: string;
  loading: string;
  error: string;
  success: string;
  currency: string;
  requiredField: string;

  // Header
  storeName: string;
  storeSubtitle: string;
  liveBadge: string;
  switchLanguage: string;

  // Try On Screen (Customer Flow)
  tryOnStep1Title: string;
  tryOnStep1Subtitle: string;
  takePhoto: string;
  pickFromGallery: string;
  changePhoto: string;
  tryOnStep2Title: string;
  tryOnStep2Subtitle: string;
  tryOnStep3Cta: string;
  photoMissingAlertTitle: string;
  photoMissingAlertMsg: string;
  garmentMissingAlertTitle: string;
  garmentMissingAlertMsg: string;
  tryOnErrorTitle: string;
  tryOnErrorMsg: string;
  garmentNotReadyMsg: string;
  viewDetails: string;
  selectedBadge: string;

  // Loading Modal
  loadingStep1: string;
  loadingStep2: string;
  loadingStep3: string;
  loadingStep4: string;
  loadingSubtext: string;
  loadingWait: string;
  aiFashionBadge: string;

  // Result Modal
  yourLookTitle: string;
  lookGeneratedBadge: string;
  aiEngineLabel: string;
  tryAnotherGarment: string;
  changeMyPhoto: string;
  shareLook: string;
  saveLook: string;
  savedSuccessTitle: string;
  savedSuccessMsg: string;
  sharePreparingTitle: string;
  sharePreparingMsg: string;

  // Catalog Screen (Unified Single Catalog)
  catalogTitle: string;
  searchPlaceholder: string;
  allCategories: string;
  catFullBody: string;
  catUpperBody: string;
  catLowerBody: string;
  catShoes: string;
  filterTitle: string;
  emptyCatalogTitle: string;
  emptyCatalogDesc: string;
  addFirstPiece: string;
  addNewPiece: string;
  noSearchResultsTitle: string;
  noSearchResultsDesc: string;
  priceAsc: string;
  priceDesc: string;

  // Product Detail Modal
  productDetailsTitle: string;
  catalogPhotoTab: string;
  catalogPhotoHelp: string;
  tryOnPhotoTab: string;
  tryOnPhotoHelp: string;
  categoryLabel: string;
  colorLabel: string;
  materialLabel: string;
  fitLabel: string;
  sizesLabel: string;
  stockLabel: string;
  stockUnitsAvailable: string;
  tryThisGarmentBtn: string;
  pieceNotFound: string;
  editPieceBtn: string;

  // Admin Product Modal (CRUD Form)
  newProductModalTitle: string;
  editProductModalTitle: string;
  productNameLabel: string;
  productNamePlaceholder: string;
  productDescLabel: string;
  productDescPlaceholder: string;
  productPriceLabel: string;
  productCurrencyLabel: string;
  productCategoryLabel: string;
  productColorLabel: string;
  productMaterialLabel: string;
  productFitLabel: string;
  productSizesLabel: string;
  productStockLabel: string;
  productAvailabilityLabel: string;
  productActiveToggle: string;
  catalogPhotoSectionTitle: string;
  catalogPhotoSectionDesc: string;
  tryOnPhotoSectionTitle: string;
  tryOnPhotoSectionDesc: string;
  photoUrlPlaceholder: string;
  saveProductBtn: string;
  invalidPriceAlert: string;
  invalidNameAlert: string;
  productSavedSuccess: string;
  deletePieceConfirmTitle: string;
  deletePieceConfirmMsg: string;
  deleteBtn: string;
  deleteSuccessMsg: string;

  // Admin Screen (Unified Admin Area)
  adminHeaderTitle: string;
  tabMyStore: string;
  tabCatalogManage: string;
  tabAIEngines: string;
  tabPreferences: string;

  // Admin: Catalog Section
  catalogManagementTitle: string;
  catalogManagementDesc: string;
  totalProductsCount: string;
  openFullCatalog: string;
  quickAdd: string;

  // Admin: AI Engines Section
  aiEnginesTitle: string;
  aiEnginesDesc: string;
  mainEngineTitle: string;
  mainEngineDesc: string;
  noEnginesConfigured: string;
  enabledEnginesTitle: string;
  perfectCorpTitle: string;
  perfectCorpDesc: string;
  googleTitle: string;
  googleDesc: string;
  statusActive: string;
  statusConnected: string;
  statusDisabled: string;
  statusUnconfigured: string;
  defaultEngineBadge: string;
  setAsMainEngineBtn: string;
  credentialMasked: string;
  editCredential: string;
  testConnection: string;
  testingConnection: string;
  connectionSuccess: string;
  connectionFailed: string;
  credentialModalTitle: string;
  credentialModalDesc: string;
  credentialInputLabel: string;
  credentialInputPlaceholder: string;
  credentialSavedSuccess: string;
  securityNoticeVault: string;

  // Admin: Semantic Diagnostic
  semanticPipelineTitle: string;
  semanticPipelineDesc: string;
  semanticLockStatus: string;
  semanticPersonRole: string;
  semanticGarmentRole: string;
  semanticDistinctNotice: string;
  runDiagnosticBtn: string;
  runningDiagnostic: string;
  semanticCheckPassed: string;
  semanticCheckFailed: string;
  dimensionsTitle: string;
  sizeTitle: string;
  mimeTitle: string;
  hashTitle: string;
  hashComparisonOk: string;
  selectPieceToInspect: string;
  garmentPrepNotice: string;

  // Admin: My Store Section
  storeInfoTitle: string;
  storeInfoDesc: string;
  storeNameField: string;
  storeSubtitleField: string;
  storeStatusField: string;
  storeStatusActive: string;
  storeSaveBtn: string;
  storeSavedMsg: string;
  teamPermissionsTitle: string;
  teamPermissionsDesc: string;
  storeOwnerRole: string;
  storeManagerRole: string;

  // Admin: Preferences Section
  preferencesTitle: string;
  preferencesDesc: string;
  languageSettingTitle: string;
  languageSettingDesc: string;
  themeSettingTitle: string;
  themeSettingDesc: string;
  roleSettingTitle: string;
  roleSettingDesc: string;
  roleOwner: string;
  roleManager: string;
  roleCustomer: string;
}

export const translations: Record<LanguageCode, Translations> = {
  pt: {
    // Navigation
    tryOnTab: 'PROVADOR',
    catalogTab: 'CATÁLOGO',
    adminTab: 'ADMINISTRAÇÃO',

    // Common
    save: 'Salvar',
    cancel: 'Cancelar',
    close: 'Fechar',
    confirm: 'Confirmar',
    delete: 'Excluir',
    edit: 'Editar',
    add: 'Adicionar',
    back: 'Voltar',
    all: 'Todas',
    inStock: 'Em estoque',
    outOfStock: 'Esgotado',
    available: 'Disponível',
    units: 'unidades',
    search: 'Buscar',
    language: 'Idioma',
    portuguese: 'Português (Brasil)',
    spanish: 'Español',
    loading: 'Carregando...',
    error: 'Ocorreu um erro',
    success: 'Sucesso',
    currency: 'Moeda',
    requiredField: 'Campo obrigatório',

    // Header
    storeName: 'ATELIER MAISON',
    storeSubtitle: 'PROVADOR VIRTUAL IA',
    liveBadge: 'AO VIVO',
    switchLanguage: 'Alterar idioma',

    // Try On Screen
    tryOnStep1Title: 'Comece com sua foto',
    tryOnStep1Subtitle: 'Tire uma foto ou escolha uma da galeria.',
    takePhoto: 'Tirar foto',
    pickFromGallery: 'Escolher da galeria',
    changePhoto: 'Trocar foto',
    tryOnStep2Title: 'Escolha uma peça',
    tryOnStep2Subtitle: 'Selecione uma peça da coleção para experimentar',
    tryOnStep3Cta: 'PROVAR AGORA',
    photoMissingAlertTitle: 'Foto necessária',
    photoMissingAlertMsg: 'Adicione uma foto para começar.',
    garmentMissingAlertTitle: 'Peça não selecionada',
    garmentMissingAlertMsg: 'Selecione uma peça para provar.',
    tryOnErrorTitle: 'Provador Virtual',
    tryOnErrorMsg: 'Não foi possível gerar o look agora. Tente novamente em instantes.',
    garmentNotReadyMsg: 'Esta peça ainda não está preparada para o provador virtual.',
    viewDetails: 'Ver detalhes',
    selectedBadge: 'SELECIONADA',

    // Loading Modal
    loadingStep1: 'Preparando seu look...',
    loadingStep2: 'Analisando a peça...',
    loadingStep3: 'Gerando seu visual...',
    loadingStep4: 'Finalizando detalhes com IA...',
    loadingSubtext: 'Processando modelagem de caimento com alta precisão visual.',
    loadingWait: 'Aguarde alguns segundos...',
    aiFashionBadge: 'IA FASHION',

    // Result Modal
    yourLookTitle: 'Seu look',
    lookGeneratedBadge: 'LOOK GERADO',
    aiEngineLabel: 'Motor de IA',
    tryAnotherGarment: 'Experimentar outra peça',
    changeMyPhoto: 'Trocar minha foto',
    shareLook: 'Compartilhar',
    saveLook: 'Salvar',
    savedSuccessTitle: 'Salvo',
    savedSuccessMsg: 'Imagem salva na sua galeria com sucesso.',
    sharePreparingTitle: 'Compartilhar',
    sharePreparingMsg: 'Preparando compartilhamento do seu look virtual.',

    // Catalog Screen
    catalogTitle: 'Coleção & Catálogo',
    searchPlaceholder: 'Buscar no catálogo por nome, tecido, cor...',
    allCategories: 'Todas as Peças',
    catFullBody: 'Corpo inteiro',
    catUpperBody: 'Parte de cima',
    catLowerBody: 'Parte de baixo',
    catShoes: 'Calçados',
    filterTitle: 'Filtrar peças',
    emptyCatalogTitle: 'Seu catálogo ainda está vazio',
    emptyCatalogDesc: 'Adicione sua primeira peça para começar a exibir em sua vitrine.',
    addFirstPiece: 'Adicionar primeira peça',
    addNewPiece: 'Nova Peça',
    noSearchResultsTitle: 'Nenhuma peça encontrada',
    noSearchResultsDesc: 'Tente buscar com outros termos ou selecione outra categoria.',
    priceAsc: 'Menor preço',
    priceDesc: 'Maior preço',

    // Product Detail Modal
    productDetailsTitle: 'Detalhes da Peça',
    catalogPhotoTab: 'FOTO DO CATÁLOGO',
    catalogPhotoHelp: 'Usada para a vitrine da loja.',
    tryOnPhotoTab: 'FOTO PARA O PROVADOR',
    tryOnPhotoHelp: 'Usada pela IA para vestir a peça na pessoa.',
    categoryLabel: 'Categoria',
    colorLabel: 'Cor',
    materialLabel: 'Composição / Material',
    fitLabel: 'Modelagem / Caimento',
    sizesLabel: 'Tamanhos disponíveis',
    stockLabel: 'Disponibilidade de estoque',
    stockUnitsAvailable: 'unidades disponíveis para envio imediato',
    tryThisGarmentBtn: 'Experimentar esta peça',
    pieceNotFound: 'Peça não encontrada',
    editPieceBtn: 'Editar Peça',

    // Admin Product Modal (CRUD)
    newProductModalTitle: 'Adicionar Nova Peça',
    editProductModalTitle: 'Editar Peça',
    productNameLabel: 'Nome da peça',
    productNamePlaceholder: 'Ex: Vestido Midi Seda Champagne',
    productDescLabel: 'Descrição detalhada',
    productDescPlaceholder: 'Detalhes do tecido, acabamentos e ocasiões de uso...',
    productPriceLabel: 'Preço',
    productCurrencyLabel: 'Moeda',
    productCategoryLabel: 'Categoria da peça',
    productColorLabel: 'Cor principal',
    productMaterialLabel: 'Material / Tecido',
    productFitLabel: 'Modelagem',
    productSizesLabel: 'Tamanhos (separados por vírgula)',
    productStockLabel: 'Quantidade em estoque',
    productAvailabilityLabel: 'Disponibilidade na loja',
    productActiveToggle: 'Peça ativa e visível no catálogo',
    catalogPhotoSectionTitle: 'FOTO DO CATÁLOGO',
    catalogPhotoSectionDesc: 'Usada para a vitrine da loja.',
    tryOnPhotoSectionTitle: 'FOTO PARA O PROVADOR',
    tryOnPhotoSectionDesc: 'Usada pela IA para vestir a peça na pessoa.',
    photoUrlPlaceholder: 'Cole aqui o link ou URL da imagem (https://...)',
    saveProductBtn: 'Salvar alterações',
    invalidPriceAlert: 'Informe um preço válido maior que zero.',
    invalidNameAlert: 'Informe o nome da peça.',
    productSavedSuccess: 'Peça salva com sucesso!',
    deletePieceConfirmTitle: 'Excluir esta peça?',
    deletePieceConfirmMsg: 'Esta ação não pode ser desfeita.',
    deleteBtn: 'Excluir',
    deleteSuccessMsg: 'Peça excluída com sucesso do catálogo.',

    // Admin Screen
    adminHeaderTitle: 'Painel de Administração',
    tabMyStore: 'Minha Loja',
    tabCatalogManage: 'Catálogo',
    tabAIEngines: 'Motores de IA',
    tabPreferences: 'Preferências',

    // Admin: Catalog Section
    catalogManagementTitle: 'Gestão de Produtos',
    catalogManagementDesc: 'Gerencie as peças do catálogo, valores, estoque e fotos para o provador virtual.',
    totalProductsCount: 'peças cadastradas na loja',
    openFullCatalog: 'Abrir Catálogo Completo',
    quickAdd: 'Adicionar Nova Peça',

    // Admin: AI Engines Section
    aiEnginesTitle: 'Motores de IA',
    aiEnginesDesc: 'Controle a tecnologia de provador virtual inteligente integrada ao seu catálogo.',
    mainEngineTitle: 'Motor Principal',
    mainEngineDesc: 'Selecione qual inteligência artificial será utilizada prioritariamente para os provadores virtuais.',
    noEnginesConfigured: 'Nenhum motor configurado',
    enabledEnginesTitle: 'Motores Habilitados',
    perfectCorpTitle: 'Perfect Corp',
    perfectCorpDesc: 'Provador virtual com IA',
    googleTitle: 'Google Gemini',
    googleDesc: 'Provador virtual com IA',
    statusActive: 'Ativo',
    statusConnected: 'Conectado',
    statusDisabled: 'Desativado',
    statusUnconfigured: 'Não conectado',
    defaultEngineBadge: 'PRINCIPAL',
    setAsMainEngineBtn: 'Definir como Principal',
    credentialMasked: 'Credencial',
    editCredential: 'Editar credencial',
    testConnection: 'Testar conexão',
    testingConnection: 'Testando conexão...',
    connectionSuccess: 'Conexão estabelecida com sucesso com o servidor.',
    connectionFailed: 'Falha no teste de conexão. Verifique a credencial.',
    credentialModalTitle: 'Configurar Credencial Segura',
    credentialModalDesc: 'A chave será transmitida diretamente ao backend seguro via HTTPS e nunca será exposta no cliente.',
    credentialInputLabel: 'Chave de API (Secret)',
    credentialInputPlaceholder: 'Insira a chave secreta da API...',
    credentialSavedSuccess: 'Credencial salva e validada com sucesso no backend.',
    securityNoticeVault: 'Segurança: As chaves são processadas exclusivamente no servidor.',

    // Admin: Semantic Diagnostic
    semanticPipelineTitle: 'Pipeline Semântico de Imagens & Diagnóstico',
    semanticPipelineDesc: 'Validação matemática e estrutural de entrada para o provador virtual IA.',
    semanticLockStatus: 'DIREÇÃO SEMÂNTICA BLOQUEADA (src_file_url = PESSOA, ref_file_url = ROUPA)',
    semanticPersonRole: 'Foto da Pessoa (src_file_url)',
    semanticGarmentRole: 'Referência da Roupa (ref_file_url)',
    semanticDistinctNotice: 'A foto de vitrine (catálogo) é estritamente separada da foto de referência IA.',
    runDiagnosticBtn: 'Executar Diagnóstico Semântico',
    runningDiagnostic: 'Validando imagens e hashes...',
    semanticCheckPassed: 'Validação Semântica: APROVADA',
    semanticCheckFailed: 'Validação Semântica: FALHOU',
    dimensionsTitle: 'Dimensões',
    sizeTitle: 'Tamanho',
    mimeTitle: 'Formato MIME',
    hashTitle: 'Hash SHA-256',
    hashComparisonOk: 'Hashes distintos confirmados. Nenhuma colisão entre pessoa e roupa.',
    selectPieceToInspect: 'Peça selecionada para diagnóstico',
    garmentPrepNotice: 'Referência isolada e validada para uso exclusivo no provador IA.',

    // Admin: My Store Section
    storeInfoTitle: 'Informações da Loja',
    storeInfoDesc: 'Configure a identidade, nome e exibição da sua loja no provador virtual.',
    storeNameField: 'Nome da Loja',
    storeSubtitleField: 'Slogan / Subtítulo',
    storeStatusField: 'Status de Operação',
    storeStatusActive: 'Loja Ativa para Clientes',
    storeSaveBtn: 'Salvar dados da loja',
    storeSavedMsg: 'Dados da loja atualizados com sucesso.',
    teamPermissionsTitle: 'Equipe & Permissões',
    teamPermissionsDesc: 'Gerencie os níveis de acesso de proprietários e gerentes da loja.',
    storeOwnerRole: 'Proprietário (Acesso completo ao Admin, Motores e Finanças)',
    storeManagerRole: 'Gerente (Edição de Catálogo e Produtos)',

    // Admin: Preferences Section
    preferencesTitle: 'Preferências Gerais',
    preferencesDesc: 'Personalize o idioma de exibição, a identidade visual e o modo de visualização.',
    languageSettingTitle: 'Idioma do Aplicativo',
    languageSettingDesc: 'Alterne instantaneamente o idioma de toda a interface entre Português e Espanhol.',
    themeSettingTitle: 'Aparência & Identidade',
    themeSettingDesc: 'Paleta Noir & Champagne Gold com acabamento de alta costura.',
    roleSettingTitle: 'Nível de Permissão',
    roleSettingDesc: 'Simule a visualização de acordo com o perfil de usuário logado.',
    roleOwner: 'Proprietário (Acesso Total)',
    roleManager: 'Gerente (Catálogo e Loja)',
    roleCustomer: 'Cliente (Apenas Visualização)',
  },

  es: {
    // Navigation
    tryOnTab: 'PROBADOR',
    catalogTab: 'CATÁLOGO',
    adminTab: 'ADMINISTRACIÓN',

    // Common
    save: 'Guardar',
    cancel: 'Cancelar',
    close: 'Cerrar',
    confirm: 'Confirmar',
    delete: 'Eliminar',
    edit: 'Editar',
    add: 'Agregar',
    back: 'Volver',
    all: 'Todas',
    inStock: 'En stock',
    outOfStock: 'Agotado',
    available: 'Disponible',
    units: 'unidades',
    search: 'Buscar',
    language: 'Idioma',
    portuguese: 'Português (Brasil)',
    spanish: 'Español',
    loading: 'Cargando...',
    error: 'Ocurrió un error',
    success: 'Éxito',
    currency: 'Moneda',
    requiredField: 'Campo obligatorio',

    // Header
    storeName: 'ATELIER MAISON',
    storeSubtitle: 'PROBADOR VIRTUAL IA',
    liveBadge: 'EN VIVO',
    switchLanguage: 'Cambiar idioma',

    // Try On Screen
    tryOnStep1Title: 'Comienza con tu foto',
    tryOnStep1Subtitle: 'Toma una foto o elige una de la galería.',
    takePhoto: 'Tomar foto',
    pickFromGallery: 'Elegir de la galería',
    changePhoto: 'Cambiar foto',
    tryOnStep2Title: 'Elige una prenda',
    tryOnStep2Subtitle: 'Selecciona una prenda de la colección para probar',
    tryOnStep3Cta: 'PROBAR AHORA',
    photoMissingAlertTitle: 'Foto necesaria',
    photoMissingAlertMsg: 'Agrega una foto para comenzar.',
    garmentMissingAlertTitle: 'Prenda no seleccionada',
    garmentMissingAlertMsg: 'Selecciona una prenda para probar.',
    tryOnErrorTitle: 'Probador Virtual',
    tryOnErrorMsg: 'No fue posible generar el look ahora. Inténtalo de nuevo en unos momentos.',
    garmentNotReadyMsg: 'Esta prenda aún no está preparada para el probador virtual.',
    viewDetails: 'Ver detalles',
    selectedBadge: 'SELECCIONADA',

    // Loading Modal
    loadingStep1: 'Preparando tu look...',
    loadingStep2: 'Analizando la prenda...',
    loadingStep3: 'Generando tu visual...',
    loadingStep4: 'Finalizando detalles con IA...',
    loadingSubtext: 'Procesando modelado de calce con alta precisión visual.',
    loadingWait: 'Espera unos segundos...',
    aiFashionBadge: 'IA FASHION',

    // Result Modal
    yourLookTitle: 'Tu look',
    lookGeneratedBadge: 'LOOK GENERADO',
    aiEngineLabel: 'Motor de IA',
    tryAnotherGarment: 'Probar otra prenda',
    changeMyPhoto: 'Cambiar mi foto',
    shareLook: 'Compartir',
    saveLook: 'Guardar',
    savedSuccessTitle: 'Guardado',
    savedSuccessMsg: 'Imagen guardada en tu galería con éxito.',
    sharePreparingTitle: 'Compartir',
    sharePreparingMsg: 'Preparando para compartir tu look virtual.',

    // Catalog Screen
    catalogTitle: 'Colección & Catálogo',
    searchPlaceholder: 'Buscar en el catálogo por nombre, tela, color...',
    allCategories: 'Todas las Prendas',
    catFullBody: 'Cuerpo entero',
    catUpperBody: 'Parte de arriba',
    catLowerBody: 'Parte de abajo',
    catShoes: 'Calzado',
    filterTitle: 'Filtrar prendas',
    emptyCatalogTitle: 'Tu catálogo todavía está vacío',
    emptyCatalogDesc: 'Agrega tu primera prenda para comenzar a mostrar en tu escaparate.',
    addFirstPiece: 'Agregar primera prenda',
    addNewPiece: 'Nueva Prenda',
    noSearchResultsTitle: 'No se encontraron prendas',
    noSearchResultsDesc: 'Intenta buscar con otros términos o selecciona otra categoría.',
    priceAsc: 'Menor precio',
    priceDesc: 'Mayor precio',

    // Product Detail Modal
    productDetailsTitle: 'Detalles de la Prenda',
    catalogPhotoTab: 'FOTO DEL CATÁLOGO',
    catalogPhotoHelp: 'Usada para el escaparate de la tienda.',
    tryOnPhotoTab: 'FOTO PARA EL PROBADOR',
    tryOnPhotoHelp: 'Usada por la IA para vestir la prenda en la persona.',
    categoryLabel: 'Categoría',
    colorLabel: 'Color',
    materialLabel: 'Composición / Material',
    fitLabel: 'Corte / Calce',
    sizesLabel: 'Tallas disponibles',
    stockLabel: 'Disponibilidad de stock',
    stockUnitsAvailable: 'unidades disponibles para envío inmediato',
    tryThisGarmentBtn: 'Probar esta prenda',
    pieceNotFound: 'Prenda no encontrada',
    editPieceBtn: 'Editar Prenda',

    // Admin Product Modal (CRUD)
    newProductModalTitle: 'Agregar Nueva Prenda',
    editProductModalTitle: 'Editar Prenda',
    productNameLabel: 'Nombre de la prenda',
    productNamePlaceholder: 'Ej: Vestido Midi Seda Champagne',
    productDescLabel: 'Descripción detallada',
    productDescPlaceholder: 'Detalles de la tela, acabados y ocasiones de uso...',
    productPriceLabel: 'Precio',
    productCurrencyLabel: 'Moneda',
    productCategoryLabel: 'Categoría de la prenda',
    productColorLabel: 'Color principal',
    productMaterialLabel: 'Material / Tela',
    productFitLabel: 'Corte / Calce',
    productSizesLabel: 'Tallas (separadas por coma)',
    productStockLabel: 'Cantidad en stock',
    productAvailabilityLabel: 'Disponibilidad en la tienda',
    productActiveToggle: 'Prenda activa y visible en el catálogo',
    catalogPhotoSectionTitle: 'FOTO DEL CATÁLOGO',
    catalogPhotoSectionDesc: 'Usada para el escaparate de la tienda.',
    tryOnPhotoSectionTitle: 'FOTO PARA EL PROBADOR',
    tryOnPhotoSectionDesc: 'Usada por la IA para vestir la prenda en la persona.',
    photoUrlPlaceholder: 'Pega aquí el enlace o URL de la imagen (https://...)',
    saveProductBtn: 'Guardar cambios',
    invalidPriceAlert: 'Ingresa un precio válido mayor a cero.',
    invalidNameAlert: 'Ingresa el nombre de la prenda.',
    productSavedSuccess: '¡Prenda guardada con éxito!',
    deletePieceConfirmTitle: '¿Eliminar esta prenda?',
    deletePieceConfirmMsg: 'Esta acción no se puede deshacer.',
    deleteBtn: 'Eliminar',
    deleteSuccessMsg: 'Prenda eliminada con éxito del catálogo.',

    // Admin Screen
    adminHeaderTitle: 'Panel de Administración',
    tabMyStore: 'Mi Tienda',
    tabCatalogManage: 'Catálogo',
    tabAIEngines: 'Motores de IA',
    tabPreferences: 'Preferencias',

    // Admin: Catalog Section
    catalogManagementTitle: 'Gestión de Productos',
    catalogManagementDesc: 'Administra las prendas del catálogo, precios, stock y fotos para el probador virtual.',
    totalProductsCount: 'prendas registradas en la tienda',
    openFullCatalog: 'Abrir Catálogo Completo',
    quickAdd: 'Agregar Nueva Prenda',

    // Admin: AI Engines Section
    aiEnginesTitle: 'Motores de IA',
    aiEnginesDesc: 'Controla la tecnología de probador virtual inteligente integrada a tu catálogo.',
    mainEngineTitle: 'Motor Principal',
    mainEngineDesc: 'Seleccione qué inteligencia artificial se utilizará prioritariamente para los probadores virtuales.',
    noEnginesConfigured: 'Ningún motor configurado',
    enabledEnginesTitle: 'Motores Habilitados',
    perfectCorpTitle: 'Perfect Corp',
    perfectCorpDesc: 'Provador virtual com IA',
    googleTitle: 'Google Gemini',
    googleDesc: 'Provador virtual com IA',
    statusActive: 'Activo',
    statusConnected: 'Conectado',
    statusDisabled: 'Desactivado',
    statusUnconfigured: 'No conectado',
    defaultEngineBadge: 'PRINCIPAL',
    setAsMainEngineBtn: 'Definir como Principal',
    credentialMasked: 'Credencial',
    editCredential: 'Editar credencial',
    testConnection: 'Probar conexión',
    testingConnection: 'Probando conexión...',
    connectionSuccess: 'Conexión establecida con éxito con el servidor.',
    connectionFailed: 'Fallo en la prueba de conexión. Verifique la credencial.',
    credentialModalTitle: 'Configurar Credencial Segura',
    credentialModalDesc: 'La clave se transmitirá directamente al backend seguro vía HTTPS y nunca se expondrá en el cliente.',
    credentialInputLabel: 'Clave de API (Secret)',
    credentialInputPlaceholder: 'Ingrese la clave secreta de la API...',
    credentialSavedSuccess: 'Credencial guardada y validada con éxito en el backend.',
    securityNoticeVault: 'Seguridad: Las claves se procesan exclusivamente en el servidor.',

    // Admin: Semantic Diagnostic
    semanticPipelineTitle: 'Pipeline Semántico de Imágenes & Diagnóstico',
    semanticPipelineDesc: 'Validación matemática y estructural de entrada para el probador virtual IA.',
    semanticLockStatus: 'DIRECCIÓN SEMÁNTICA BLOQUEADA (src_file_url = PERSONA, ref_file_url = PRENDA)',
    semanticPersonRole: 'Foto de la Persona (src_file_url)',
    semanticGarmentRole: 'Referencia de la Prenda (ref_file_url)',
    semanticDistinctNotice: 'La foto de escaparate (catálogo) está estrictamente separada de la foto de referencia IA.',
    runDiagnosticBtn: 'Ejecutar Diagnóstico Semántico',
    runningDiagnostic: 'Validando imágenes y hashes...',
    semanticCheckPassed: 'Validación Semántica: APROBADA',
    semanticCheckFailed: 'Validación Semántica: FALLÓ',
    dimensionsTitle: 'Dimensiones',
    sizeTitle: 'Tamaño',
    mimeTitle: 'Formato MIME',
    hashTitle: 'Hash SHA-256',
    hashComparisonOk: 'Hashes distintos confirmados. Sin colisión entre persona y prenda.',
    selectPieceToInspect: 'Prenda seleccionada para diagnóstico',
    garmentPrepNotice: 'Referencia aislada y validada para uso exclusivo en el probador IA.',

    // Admin: My Store Section
    storeInfoTitle: 'Información de la Tienda',
    storeInfoDesc: 'Configura la identidad, nombre y visualización de tu tienda en el probador virtual.',
    storeNameField: 'Nombre de la Tienda',
    storeSubtitleField: 'Eslogan / Subtítulo',
    storeStatusField: 'Estado de Operación',
    storeStatusActive: 'Tienda Activa para Clientes',
    storeSaveBtn: 'Guardar datos de la tienda',
    storeSavedMsg: 'Datos de la tienda actualizados con éxito.',
    teamPermissionsTitle: 'Equipo & Permisos',
    teamPermissionsDesc: 'Gestiona los niveles de acceso de propietarios y gerentes de la tienda.',
    storeOwnerRole: 'Propietario (Acceso completo a Administración, Motores y Finanzas)',
    storeManagerRole: 'Gerente (Edición de Catálogo y Productos)',

    // Admin: Preferences Section
    preferencesTitle: 'Preferencias Generales',
    preferencesDesc: 'Personaliza el idioma de visualización, la identidad visual y el modo de vista.',
    languageSettingTitle: 'Idioma de la Aplicación',
    languageSettingDesc: 'Cambia instantáneamente el idioma de toda la interfaz entre Portugués y Español.',
    themeSettingTitle: 'Apariencia & Identidad',
    themeSettingDesc: 'Paleta Noir & Champagne Gold con acabado de alta costura.',
    roleSettingTitle: 'Nivel de Permiso',
    roleSettingDesc: 'Simula la visualización de acuerdo con el perfil del usuario activo.',
    roleOwner: 'Propietario (Acceso Total)',
    roleManager: 'Gerente (Catálogo y Tienda)',
    roleCustomer: 'Cliente (Solo Visualización)',
  },
};
