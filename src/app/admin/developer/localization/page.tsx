"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, writeBatch, setDoc, query, where, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Save, Search, Languages } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const DEFAULT_TRANSLATIONS: { [key: string]: { [key: string]: string } } = {
    "dashboard.welcome": { "en": "Welcome!", "ht": "Byenveni!", "fr": "Bienvenue!", "es": "¡Bienvenido!" },
    "dashboard.welcome_back": { "en": "Welcome Back,", "ht": "Byenveni ankò,", "fr": "Bon retour,", "es": "Bienvenido de nuevo," },
    "dashboard.signin_desc": { "en": "Sign in to pick up where you left off.", "ht": "Konekte pou kontinye kote ou te rete a.", "fr": "Connectez-vous pour reprendre là où vous vous étiez arrêté.", "es": "Inicie sesión para retomar donde lo dejó." },
    "dashboard.signin_button": { "en": "Sign In", "ht": "Konekte", "fr": "Se connecter", "es": "Iniciar sesión" },
    "dashboard.notice.title": { "en": "Important Notice", "ht": "Avi Enpòtan", "fr": "Avis Important", "es": "Aviso Importante" },
    "dashboard.notice.text": { "en": "To be eligible for graduation, all required courses must be completed, and active participation in a ministry is required.", "ht": "Pou w ka gradye, ou dwe konplete tout kou yo mande yo, epi ou dwe patisipe aktivman nan yon ministè.", "fr": "Pour être admissible à la graduation, tous les cours requis doivent être terminés et une participation active dans un ministère est requise.", "es": "Para ser elegible para la graduación, deben completarse todos los cursos requeridos y se requiere una participación activa en un ministerio." },
    "dashboard.ladder_progress.title": { "en": "My Ladder Progress", "ht": "Pwogrè Nechèl mwen", "fr": "Ma progression dans l'échelle", "es": "Mi progreso en la escala" },
    "dashboard.ladder_progress.description": { "en": "Your progress in the current ladder.", "ht": "Pwogrè ou nan nechèl aktyèl la.", "fr": "Votre progression dans l'échelle actuelle.", "es": "Tu progreso en la escala actual." },
    "dashboard.ladder_progress.summary": { "en": "{{completed}} of {{total}} courses completed", "ht": "{{completed}} nan {{total}} kou konplete", "fr": "{{completed}} sur {{total}} cours terminés", "es": "{{completed}} de {{total}} cursos completados" },
    "dashboard.ladder_progress.complete_title": { "en": "Ladder Complete!", "ht": "Nechèl Konplè!", "fr": "Échelle terminée!", "es": "¡Escala completa!" },
    "dashboard.ladder_progress.complete_desc": { "en": "You are qualified to become a potential candidate for the next level.", "ht": "Ou kalifye pou w vin yon kandida potansyèl pou pwochen nivo a.", "fr": "Vous êtes qualifié pour devenir un candidat potentiel pour le niveau suivant.", "es": "Estás calificado para convertirte en un candidato potencial para el siguiente nivel." },
    "dashboard.ladder_progress.request_button": { "en": "Request Promotion", "ht": "Mande Pwomosyon", "fr": "Demander une promotion", "es": "Solicitar promoción" },
    "dashboard.sections.continue": { "en": "Continue Learning", "ht": "Kontinye Aprann", "fr": "Continuer l'apprentissage", "es": "Continuar aprendiendo" },
    "dashboard.sections.courses_in": { "en": "Courses in:", "ht": "Kou nan:", "fr": "Cours en:", "es": "Cursos en:" },
    "dashboard.sections.completed": { "en": "Completed Courses", "ht": "Kou ki konplete", "fr": "Cours terminés", "es": "Cursos completados" },
    "dashboard.button.view_all": { "en": "View All", "ht": "Wè tout", "fr": "Voir tout", "es": "Ver todo" },
    "login.title": { "en": "Welcome Back", "ht": "Byenveni ankò", "fr": "Bon retour", "es": "Bienvenido de nouveau" },
    "nav.dashboard": { "en": "Dashboard", "ht": "Dachbòd", "fr": "Tableau de bord", "es": "Panel de control" },
    "nav.courses": { "en": "All Courses", "ht": "Tout Kou yo", "fr": "Tous les cours", "es": "Todos los cursos" },
    "nav.ministry_training": { "en": "Ministry Training", "ht": "Fòmasyon Ministè", "fr": "Formation au ministère", "es": "Formación ministerial" },
    "nav.my_certificates": { "en": "My Certificates", "ht": "Sètifika mwen yo", "fr": "Mes certificats", "es": "Mis certificados" },
    "nav.live": { "en": "Live", "ht": "An dirèk", "fr": "En direct", "es": "En vivo" },
    "nav.teaching": { "en": "Teaching", "ht": "Ansèyman", "fr": "Enseignement", "es": "Enseignanza" },
    "nav.music": { "en": "Music", "ht": "Mizik", "fr": "Musique", "es": "Música" },
    "nav.community": { "en": "Community", "ht": "Kominote", "fr": "Communauté", "es": "Comunidad" },
    "nav.documentation": { "en": "Documentation", "ht": "Dokimantasyon", "fr": "Documentation", "es": "Documentación" },
    "nav.admin_panel": { "en": "Admin Panel", "ht": "Panèl Administratè", "fr": "Panneau d'administration", "es": "Panel de administración" },
    "nav.complete_profile": { "en": "Complete Profile", "ht": "Ranpli Pwofil", "fr": "Compléter le profil", "es": "Completar perfil" },
    "nav.settings": { "en": "Settings", "ht": "Anviwònman", "fr": "Paramètres", "es": "Configuración" },
    "nav.logout": { "en": "Log Out", "ht": "Dekonekte", "fr": "Se déconnecter", "es": "Cerrar sesión" },
    "nav.student_view": { "en": "Student View", "ht": "Vi Etidyan", "fr": "Vue étudiante", "es": "Vista del estudiante" },
    "nav.profile.ministry_label": { "en": "Ministry", "ht": "Ministè", "fr": "Ministère", "es": "Ministerio" },
    "nav.more": { "en": "More", "ht": "Plis", "fr": "Plus", "es": "Más" },
    "settings.tabs.profile": { "en": "Profile", "ht": "Pwofil", "fr": "Profil", "es": "Perfil" },
    "settings.tabs.achievements": { "en": "My Achievements", "ht": "Reyisit mwen yo", "fr": "Mes réussites", "es": "Mis logros" },
    "settings.labels.update_photo": { "en": "Update Profile Picture", "ht": "Chanje foto pwofil", "fr": "Modifier la photo de profil", "es": "Actualizar foto de perfil" },
    "settings.labels.first_name": { "en": "First Name", "ht": "Prenon", "fr": "Prénom", "es": "Nombre" },
    "settings.labels.last_name": { "en": "Last Name", "ht": "Non", "fr": "Nom", "es": "Apellido" },
    "settings.labels.gender": { "en": "Gender", "ht": "Sèks", "fr": "Genre", "es": "Género" },
    "settings.labels.age_range": { "en": "Age Range", "ht": "Gwoup laj", "fr": "Tranche d'âge", "es": "Tranche d'âge" },
    "settings.labels.phone": { "en": "Phone Number", "ht": "Nimewo telefòn", "fr": "Numéro de téléphone", "es": "Número de teléfono" },
    "settings.labels.in_hp": { "en": "Are you in a Prayer Group (HP)?", "ht": "Èske ou nan yon gwoup priyè (HP)?", "fr": "Êtes-vous dans un groupe de prière (HP) ?", "es": "¿Estás en un grupo de oración (HP)?" },
    "settings.labels.hp_number": { "en": "HP Number", "ht": "Nimewo HP", "fr": "Numéro de HP", "es": "Número de HP" },
    "settings.labels.facilitator": { "en": "Facilitator's Full Name", "ht": "Non konplè fasilitatè a", "fr": "Nom complet du facilitateur", "es": "Nombre completo del facilitador" },
    "settings.labels.hp_day": { "en": "HP Availability Day", "ht": "Jou disponiblite HP", "fr": "Jour de disponibilité HP", "es": "Día de disponibilidad de HP" },
    "settings.labels.hp_time": { "en": "HP Availability Time", "ht": "Lè disponiblite HP", "fr": "Heure de disponibilité HP", "es": "Hora de disponibilidad de HP" },
    "settings.labels.is_baptized": { "en": "Are you baptized?", "ht": "Èske ou batize?", "fr": "Êtes-vous baptisé ?", "es": "¿Estás bautizado?" },
    "settings.labels.denomination": { "en": "Denomination", "ht": "Denominasyon", "fr": "Dénomination", "es": "Denominación" },
    "settings.labels.campus": { "en": "Campus", "ht": "Kanpis", "fr": "Campus", "es": "Campus" },
    "settings.labels.attending": { "en": "I'm attending", "ht": "M ap patisipe", "fr": "Je participe", "es": "Estoy asistiendo" },
    "settings.labels.language": { "en": "Language", "ht": "Lang", "fr": "Langue", "es": "Idioma" },
    "settings.labels.ladder": { "en": "Class Ladder", "ht": "Nechèl klas la", "fr": "Échelle de classe", "es": "Escala de classe" },
    "settings.labels.side": { "en": "Side", "ht": "Kote", "fr": "Côté", "es": "Lado" },
    "settings.labels.charge": { "en": "Charge", "ht": "Chaj", "fr": "Charge", "es": "Cargo" },
    "settings.labels.role": { "en": "Role", "ht": "Wòl", "fr": "Rôle", "es": "Rol" },
    "settings.labels.bio": { "en": "Profile Bio", "ht": "Biyo pwofil", "fr": "Bio du profil", "es": "Biografía del perfil" },
    "settings.placeholder.bio": { "en": "Tell us a little about yourself...", "ht": "Rakonte nou yon ti kras sou tèt ou...", "fr": "Dites-nous en un peu plus sur vous...", "es": "Cuéntanos un poco sobre ti..." },
    "settings.button.clear": { "en": "Clear Form", "ht": "Efase fòm nan", "fr": "Effacer le formulaire", "es": "Limpiar formulario" },
    "settings.button.save": { "en": "Save Changes", "ht": "Anrejistre chanjman yo", "fr": "Enregistrer les modifications", "es": "Guardar cambios" },
    "common.gender.male": { "en": "Male", "ht": "Gason", "fr": "Homme", "es": "Masculino" },
    "common.gender.female": { "en": "Female", "ht": "Fi", "fr": "Femme", "es": "Femenino" },
    "common.location.onsite": { "en": "Onsite", "ht": "Sou plas", "fr": "Sur place", "es": "En el sitio" },
    "common.location.online": { "en": "Online", "ht": "Anliy", "fr": "En ligne", "es": "En línea" },
    "common.yes": { "en": "Yes", "ht": "Wi", "fr": "Oui", "es": "Sí" },
    "common.no": { "en": "No", "ht": "Non", "fr": "Non", "es": "No" },
    "auth.signup.title": { "en": "Create an Account", "ht": "Kreye yon kont", "fr": "Créer un compte", "es": "Crear una cuenta" },
    "auth.signup.subtitle": { "en": "Start your learning journey", "ht": "Kòmanse vwayaj aprantisaj ou", "fr": "Commencez votre parcours d'apprentissage", "es": "Comienza tu viaje de aprendizaje" },
    "auth.signup.button": { "en": "Create account", "ht": "Kreye kont", "fr": "Créer un compte", "es": "Crear cuenta" },
    "auth.signup.or": { "en": "Or continue with", "ht": "Oswa kontinye avèk", "fr": "Ou continuez avec", "es": "O continuar con" },
    "auth.signup.google": { "en": "Sign up with Google", "ht": "Enskri ak Google", "fr": "S'inscrire with Google", "es": "Registrarse con Google" },
    "auth.signup.login_prompt": { "en": "Already have an account?", "ht": "Ou gen yon kont deja?", "fr": "Vous avez déjà un compte ?", "es": "¿Ya tienes una cuenta?" },
    "auth.signup.login_link": { "en": "Log in", "ht": "Konekte", "fr": "Se connecter", "es": "Iniciar sesión" },
    "auth.login.title": { "en": "Welcome Back", "ht": "Byenveni ankò", "fr": "Bon retour", "es": "Bienvenido de nouveau" },
    "auth.login.subtitle_code": { "en": "Enter your email to get a sign-in link.", "ht": "Mete imèl ou pou resevwa yon lyen koneksyon.", "fr": "Entrez votre e-mail pour recevoir un lien de connexion.", "es": "Ingresa tu correo para recibir un enlace de inicio de sesión." },
    "auth.login.subtitle_sent": { "en": "A sign-in link has been sent to your email.", "ht": "Yo voye yon lyen koneksyon nan imèl ou.", "fr": "Un lien de connexion a été envoyé à votre e-mail.", "es": "Se ha enviado un enlace de inicio de sesión a tu correo." },
    "auth.login.subtitle_password": { "en": "Enter your credentials to access your account.", "ht": "Mete enfòmasyon ou yo pou aksede kont ou.", "fr": "Entrez vos identifiants pour accéder à votre compte.", "es": "Ingresa tus credenciales para acceder a tu cuenta." },
    "auth.login.forgot_password": { "en": "Forgot your password?", "ht": "Ou bliye modpas ou?", "fr": "Mot de passe oublié ?", "es": "¿Olvidaste tu contraseña?" },
    "auth.login.button": { "en": "Log in", "ht": "Konekte", "fr": "Se connecter", "es": "Iniciar sesión" },
    "auth.login.switch_password": { "en": "Sign in with password instead", "ht": "Konekte ak modpas pito", "fr": "Se connecter avec un mot de passe plutôt", "es": "Iniciar sesión con contraseña" },
    "auth.login.switch_code": { "en": "Sign in with a link instead", "ht": "Konekte ak yon lyen pito", "fr": "Se connecter avec un lien plutôt", "es": "Iniciar sesión con un lien" },
    "auth.login.google": { "en": "Login with Google", "ht": "Konekte ak Google", "fr": "Se connecter with Google", "es": "Iniciar sesión con Google" },
    "auth.login.signup_prompt": { "en": "Don't have an account?", "ht": "Ou pa gen kont?", "fr": "Vous n'avez pas de compte ?", "es": "¿No tienes una cuenta?" },
    "auth.login.signup_link": { "en": "Sign up", "ht": "Enskri", "fr": "S'inscrire", "es": "Registrarse" },
    "courses.title": { "en": "COURSES", "ht": "KOU YO", "fr": "COURS", "es": "CURSOS" },
    "courses.subtitle": { "en": "Expand your knowledge with our extensive library.", "ht": "Devlope konesans ou ak gwo libreri nou an.", "fr": "Développez vos connaissances grâce à notre vaste bibliothèque.", "es": "Amplía tus conocimientos con nuestra amplia biblioteca." },
    "courses.add_button": { "en": "Add Course", "ht": "Ajoute yon Kou", "fr": "Ajouter un cours", "es": "Agregar curso" },
    "courses.search_placeholder": { "en": "Search by course title...", "ht": "Chèche pa tit kou...", "fr": "Rechercher par titre de cours...", "es": "Buscar por título de curso..." },
    "courses.filter.ladders_placeholder": { "en": "Filter by Class Ladder", "ht": "Filtre pa Nechèl Klas", "fr": "Filtrer par échelle de classe", "es": "Filtrar por escala de classe" },
    "courses.filter.all_ladders": { "en": "All Class Ladders", "ht": "Tout Nechèl Klas yo", "fr": "Toutes les échelles de classe", "es": "Todas las escalas de clase" },
    "courses.empty_state": { "en": "No courses match your current filters.", "ht": "Pa gen okenn kou ki koresponn ak filtè ou yo.", "fr": "Aucun cours ne correspond à vos filtres actuels.", "es": "No hay cursos que coincidan con tus filtros actuales." },
    "courses.uncategorized": { "en": "Uncategorized", "ht": "San Kategori", "fr": "Non classé", "es": "Sin categoría" },
    "course.status.completed": { "en": "Completed", "ht": "Konplete", "fr": "Terminé", "es": "Completado" },
    "course.status.locked": { "en": "Locked", "ht": "Bloke", "fr": "Verrouillé", "es": "Bloqué" },
    "course.info.lessons": { "en": "lessons", "ht": "leson", "fr": "leçons", "es": "lecciones" },
    "course.info.enrolled": { "en": "enrolled", "ht": "enskri", "fr": "inscrits", "es": "inscritos" },
    "course.info.order": { "en": "Order", "ht": "Lòd", "fr": "Ordre", "es": "Orden" },
    "course.label.progress": { "en": "Progress", "ht": "Pwogrè", "fr": "Progression", "es": "Progreso" },
    "course.info.default_speaker": { "en": "Glory Training Hub", "ht": "Glory Training Hub", "fr": "Glory Training Hub", "es": "Glory Training Hub" },
    "course.action.preview": { "en": "Preview", "ht": "Preview", "fr": "Aperçu", "es": "Vista previa" },
    "course.action.enroll": { "en": "Enroll Now", "ht": "Enskri Kounye a", "fr": "S'inscrire maintenant", "es": "Inscribirse ahora" },
    "course.action.resume": { "en": "Resume", "ht": "Kontinye", "fr": "Reprendre", "es": "Reanudar" },
    "course.action.edit": { "en": "Edit", "ht": "Modifye", "fr": "Modifier", "es": "Editar" },
    "course.action.duplicate": { "en": "Duplicate", "ht": "Dous", "fr": "Dupliquer", "es": "Duplicar" },
    "course.action.delete": { "en": "Delete", "ht": "Efase", "fr": "Supprimer", "es": "Eliminar" },
    "course.action.review": { "en": "Review Course", "ht": "Revize Kou", "fr": "Réviser le cours", "es": "Revisar curso" },
    "course.action.go_to": { "en": "Go to Course", "ht": "Ale nan Kou", "fr": "Aller au cours", "es": "Ir al cours" },
    "course.alert.delete_title": { "en": "Are you absolutely sure?", "ht": "Èske ou sèten?", "fr": "Êtes-vous absolument sûr ?", "es": "¿Estás absolutamente seguro?" },
    "course.alert.delete_desc": { "en": "This action cannot be undone. This will permanently delete the course \"{{title}}\".", "ht": "Aksyon sa a pa ka anile. Sa pral efase kou \"{{title}}\" a nèt ale.", "fr": "Cette action ne peut pas être annulée. Cela supprimera définitivement le cours « {{title}} ».", "es": "Esta acción no se puede deshacer. Esto eliminará permanentemente el curso \"{{title}}\"." },
    "course.alert.cancel": { "en": "Cancel", "ht": "Anile", "fr": "Annuler", "es": "Cancelar" },
    "course.alert.delete_confirm": { "en": "Delete", "ht": "Efase", "fr": "Supprimer", "es": "Eliminar" },
    "course.tooltip.prereq": { "en": "Complete \"{{title}}\" to unlock.", "ht": "Konplete \"{{title}}\" pou debloke.", "fr": "Terminez « {{title}} » pour déverrouiller.", "es": "Completa \"{{title}}\" para desbloquear." },
    "course.tooltip.higher_ladder": { "en": "This is in a higher ladder and locked for now.", "ht": "Sa a nan yon nechèl pi wo epi li bloke pou kounye a.", "fr": "Ceci est dans une échelle supérieure et verrouillé for the moment.", "es": "Esto está en una escala superior y bloqueado por ahora." },
    "course.preview.lessons_title": { "en": "Lessons in this course", "ht": "Leson nan kou sa a", "fr": "Leçons de ce cours", "es": "Lecciones de este curso" },
    "course.preview.no_lessons": { "en": "No lessons available yet.", "ht": "Pa gen leson ankò.", "fr": "Aucune leçon disponible pour le moment.", "es": "No hay lecciones disponibles todavía." },
    "community.create.title": { "en": "Create Post", "ht": "Kreye Post", "fr": "Créer un message", "es": "Crear publicación" },
    "community.create.placeholder": { "en": "Share your thoughts...", "ht": "Pataje sa w ap panse...", "fr": "Partagez vos pensées...", "es": "Comparte tus pensamientos..." },
    "community.create.button": { "en": "Post", "ht": "Poste", "fr": "Publier", "es": "Publicar" },
    "community.create.label_url": { "en": "URL", "ht": "URL", "fr": "URL", "es": "URL" },
    "community.create.label_label": { "en": "Label (Optional)", "ht": "Etikèt (Opsyonèl)", "fr": "Étiquette (Optionnel)", "es": "Etiqueta (Opcional)" },
    "community.create.add_link": { "en": "Add Link", "ht": "Ajoute Lyen", "fr": "Ajouter un lien", "es": "Agregar enlace" },
    "community.create.insert_link": { "en": "Insert Link", "ht": "Mete Lyen", "fr": "Insérer un lien", "es": "Insertar enlace" },
    "community.create.repost_title": { "en": "Add your thoughts", "ht": "Ajoute panse w", "fr": "Ajoutez vos pensées", "es": "Añade tus pensamientos" },
    "community.create.success": { "en": "Post created successfully!", "ht": "Post la kreye ak siksè!", "fr": "Message créé avec succès !", "es": "¡Publicación creada con éxito!" },
    "community.create.error": { "en": "Failed to create post.", "ht": "Post la pa ka kreye.", "fr": "Échec de la création du message.", "es": "Error al crear la publicación." },
    "community.reply.placeholder": { "en": "Replying to {{name}}...", "ht": "Reponn {{name}}...", "fr": "Répondre à {{name}}...", "es": "Respondiendo a {{name}}..." },
    "community.reply.button": { "en": "Reply", "ht": "Reponn", "fr": "Répondre", "es": "Responder" },
    "community.reply.cancel": { "en": "Cancel", "ht": "Anile", "fr": "Annuler", "es": "Cancelar" },
    "community.post.share_success": { "en": "Link copied to clipboard", "ht": "Lyen an kopye", "fr": "Lien copié dans le presse-papiers", "es": "Enlace copiado al portapapeles" },
    "community.post.delete_confirm": { "en": "Are you sure you want to delete this post?", "ht": "Èske ou sèten ou vle efase post sa a?", "fr": "Êtes-vous sûr de vouloir supprimer ce message ?", "es": "¿Estás seguro de que quieres eliminar esta publicación?" },
    "community.post.delete_reply_confirm": { "en": "Are you sure you want to delete this reply?", "ht": "Èske ou sèten ou vle efase repons sa a?", "fr": "Êtes-vous sûr de vouloir supprimer cette réponse ?", "es": "¿Estás seguro de que quieres eliminar esta respuesta?" },
    "community.feed.new_posts": { "en": "Show {{count}} new posts", "ht": "Montre {{count}} nouvo post", "fr": "Afficher {{count}} nouveaux messages", "es": "Mostrar {{count}} nuevas publicaciones" },
};

const DEFAULT_LANGUAGES = [
    { code: 'en', name: 'English' },
    { code: 'ht', name: 'Haitian; Haitian Creole' },
    { code: 'fr', name: 'French' },
    { code: 'es', name: 'Spanish; Castilian' },
];

interface StoredLanguage {
    id: string; // The two-letter language code (e.g., "en")
    name: string; // The full name (e.g., "English")
    status: 'published' | 'private';
}

interface TranslationDoc {
    id: string;
    [key: string]: string;
}

export default function LocalizationManager() {
    const [translations, setTranslations] = useState<TranslationDoc[]>([]);
    const [activeLanguages, setActiveLanguages] = useState<StoredLanguage[]>([]);
    const [changedKeys, setChangedKeys] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isInitializing, setIsInitializing] = useState(false);
    const { toast } = useToast();

    const fetchLanguagesAndTranslations = useCallback(async () => {
        setLoading(true);
        try {
            const langQuery = query(collection(db, 'languages'), where('status', '==', 'published'));
            const langSnapshot = await getDocs(langQuery);
            const langList = langSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoredLanguage));
            setActiveLanguages(langList);

            const transSnapshot = await getDocs(collection(db, 'translations'));
            const transData = transSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as TranslationDoc));
            setTranslations(transData);

        } catch (error) {
            console.error("Error fetching data:", error);
            toast({ variant: 'destructive', title: 'Failed to load localization data.' });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchLanguagesAndTranslations();
    }, [fetchLanguagesAndTranslations]);

    const handleInitializeTranslations = async () => {
        setIsInitializing(true);
        try {
            const batch = writeBatch(db);
            
            // 1. Initialize Default Languages if none exist
            const existingLangs = new Set((await getDocs(collection(db, 'languages'))).docs.map(d => d.id));
            DEFAULT_LANGUAGES.forEach(lang => {
                if (!existingLangs.has(lang.code)) {
                    const langRef = doc(db, 'languages', lang.code);
                    batch.set(langRef, { name: lang.name, status: 'published' });
                }
            });

            // 2. Initialize Default Translation Keys
            const existingKeys = new Set(translations.map(t => t.id));
            let addedCount = 0;

            Object.entries(DEFAULT_TRANSLATIONS).forEach(([key, value]) => {
                if (!existingKeys.has(key)) {
                    const docRef = doc(db, 'translations', key);
                    batch.set(docRef, value);
                    addedCount++;
                }
            });

            await batch.commit();
            toast({ title: 'Success', description: `Localization system initialized with ${addedCount} new translation keys.` });
            fetchLanguagesAndTranslations();

        } catch (error) {
            console.error("Error initializing translations:", error);
            toast({ variant: 'destructive', title: 'Initialization Failed.' });
        } finally {
            setIsInitializing(false);
        }
    };

    const handleTextChange = (key: string, locale: string, value: string) => {
        setTranslations(prev =>
            prev.map(t => (t.id === key ? { ...t, [locale]: value } : t))
        );
        setChangedKeys(prev => new Set(prev).add(key));
    };

    const handleSaveChanges = async () => {
        setSaving(true);
        const batch = writeBatch(db);
        let changesCount = 0;

        changedKeys.forEach(key => {
            const translationDoc = translations.find(t => t.id === key);
            if (translationDoc) {
                const { id, ...data } = translationDoc;
                const docRef = doc(db, 'translations', id);
                batch.update(docRef, data);
                changesCount++;
            }
        });
        
        try {
            await batch.commit();
            toast({ title: 'Success', description: `${changesCount} translations updated successfully.` });
            setChangedKeys(new Set());
        } catch (error) {
            console.error("Error saving translations:", error);
            toast({ variant: 'destructive', title: 'Failed to save changes.' });
        } finally {
            setSaving(false);
        }
    };

    const filteredTranslations = useMemo(() => {
        if (!searchTerm) return translations;
        const lowercasedSearch = searchTerm.toLowerCase();
        return translations.filter(t =>
            t.id.toLowerCase().includes(lowercasedSearch) ||
            Object.values(t).some(val => String(val).toLowerCase().includes(lowercasedSearch)) ||
            DEFAULT_TRANSLATIONS[t.id]?.en?.toLowerCase().includes(lowercasedSearch)
        );
    }, [searchTerm, translations]);

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div>
                        <CardTitle>Translation Management</CardTitle>
                        <CardDescription>Edit text content for all supported languages.</CardDescription>
                    </div>
                    <div className="flex w-full sm:w-auto gap-2">
                        <Button onClick={handleInitializeTranslations} disabled={isInitializing || loading}>
                            {isInitializing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Languages className="mr-2 h-4 w-4" />}
                            Sync Keys
                        </Button>
                        <div className="relative flex-1 sm:flex-initial">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search keys or text..."
                                className="pl-8"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                         <Button onClick={handleSaveChanges} disabled={saving || changedKeys.size === 0}>
                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Save ({changedKeys.size})
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="min-w-[200px]">Translation Key</TableHead>
                                {activeLanguages.map(lang => (
                                    <TableHead key={lang.id} className="min-w-[250px] uppercase">{lang.name}</TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-8 w-full" /></TableCell>
                                        {activeLanguages.map(lang => (
                                            <TableCell key={lang.id}><Skeleton className="h-8 w-full" /></TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : filteredTranslations.length > 0 ? (
                                filteredTranslations.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell className="font-mono text-xs">{item.id}</TableCell>
                                        {activeLanguages.map(lang => (
                                            <TableCell key={lang.id}>
                                                <Textarea
                                                    value={item[lang.id] || ''}
                                                    onChange={(e) => handleTextChange(item.id, lang.id, e.target.value)}
                                                    placeholder={item.en || DEFAULT_TRANSLATIONS[item.id]?.en || ''}
                                                    className={`min-h-[60px] ${!item[lang.id] && 'placeholder:text-muted-foreground/60'}`}
                                                    rows={2}
                                                />
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : (
                                 <TableRow>
                                    <TableCell colSpan={activeLanguages.length + 1} className="text-center py-8">
                                        <p className="text-muted-foreground">
                                            {translations.length === 0 ? 'No translation keys found. Click "Sync Keys" to get started.' : 'No results found for your search.'}
                                        </p>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}