// EN/ES/FR translation dictionary for the language switch in script.js.
// Keyed by the same string each translatable element carries in its
// data-i18n attribute in index.html; English isn't listed here since it's
// the language already baked into index.html's markup — script.js falls
// back to that original markup whenever a key has no translations.es/.fr
// entry (or the switch is set to "en").
/* exported TRANSLATIONS */
const TRANSLATIONS = {
  es: {
    "nav-about": "Acerca de",
    "nav-experience": "Experiencia",
    "nav-projects": "Proyectos personales",
    "nav-hobbies": "Pasatiempos",

    "greeting": 'Hola, <br> soy <span class="accent">Lian</span>...',
    "subtext": `
        Ingeniera de Datos que construye la infraestructura invisible que hace que los datos sean confiables — pipelines, no hojas de cálculo. <br>
        Nativa de AWS, hablo PySpark con fluidez y escribo SQL como un segundo idioma. Últimamente he estado incorporando herramientas de IA a mi flujo de trabajo — el mismo rigor, con una iteración más rápida.
      `,

    "about-heading": "Sobre mí",
    "about-body": `
        Actualmente soy Ingeniera de Datos en
        <a href="https://www.wizeline.com/" target="_blank" rel="noopener" class="inline-link">Wizeline</a>,
        donde construyo pipelines e infraestructura de datos para clientes como Dow Jones y
        Kellogg's, sobre PySpark y AWS. Anteriormente trabajé en
        <a href="https://www.indragroup.com/es/america-latina/mexico" target="_blank" rel="noopener" class="inline-link">Indra</a>,
        <a href="https://www.xaldigital.com/" target="_blank" rel="noopener" class="inline-link">XalDigital</a> e
        <a href="https://www.gob.mx/ineel" target="_blank" rel="noopener" class="inline-link">INEEL</a>,
        donde aprendí el oficio migrando sistemas legados a arquitecturas modernas nativas en la nube.
      `,
    "about-leisure": "En mis tiempos de ocio me gusta ver videos en YouTube para practicar y mejorar mi francés, me gusta leer sobre salud intestinal y montar a caballo los fines de semana. Mi app favorita es Pinterest.",

    "experience-heading": "Experiencia",

    "wizeline-role": "Ingeniera de Datos Senior",
    "wizeline-dates": "OCT 2021 — ACTUALIDAD · REMOTO",
    "wizeline-dowjones-bullets": `
                <li>Desarrollé reportes con PySpark aplicando lógica y reglas de negocio, desplegando los datos finales en tablas de Athena para su visualización.</li>
                <li>Identifiqué, evalué e implementé mejoras de proceso, analizando su impacto en los resultados del proyecto.</li>
                <li>Migré DAGs de Airflow tradicional a MWAA, mejorando la eficiencia y el rendimiento.</li>
                <li>Hice la transición de procesos de EMR a EMR Serverless, mejorando la escalabilidad y reduciendo la sobrecarga operativa y los tiempos de procesamiento.</li>
              `,
    "wizeline-kelloggs-bullets": `
                <li>Lideré el proyecto para optimizar y adaptar una aplicación web para monitorear y gestionar información financiera de ventas, previamente almacenada en una hoja de cálculo de Excel.</li>
                <li>Fui el enlace principal con el cliente, coordinando a un equipo de diseñadores y desarrolladores y traduciendo requerimientos complejos para el equipo.</li>
              `,
    "wizeline-academy-bullets": `
                <li>Diseñé y creé la ruta de aprendizaje del Data Engineering Apprenticeship.</li>
                <li>Trabajé en el modelado de datos y la optimización del proyecto final del Apprenticeship — utilizado por Wizeline para evaluar a nuevas contrataciones del equipo de Datos.</li>
              `,

    "de-role": "Ingeniera de Datos",

    "indra-dates": "ABR 2021 — OCT 2021 · REMOTO",
    "indra-bullets": `
              <li>Migré un proceso de Legacy a la plataforma Datio para construir un universo de datos de contratos y clientes morosos.</li>
              <li>Elaboré pruebas unitarias y de aceptación.</li>
            `,

    "xaldigital-dates": "DIC 2018 — DIC 2020 · CIUDAD DE MÉXICO",
    "xaldigital-bullets": `
              <li>Trabajé en proyectos de los sectores retail y seguros.</li>
              <li>Migré todo un proceso de planeación de surtido de archivos de Excel a PySpark.</li>
              <li>Automaticé pipelines de ETL usando servicios de AWS.</li>
              <li>Migré procesos de SQL a PySpark para mejorar la eficiencia y escalabilidad.</li>
              <li>Lideré el levantamiento de requerimientos y el análisis de negocio para proponer una arquitectura de Data Lake en AWS.</li>
              <li>Desarrollé una prueba de concepto para generar pronósticos de demanda de productos, arquitectada en AWS.</li>
              <li>Redacté documentación funcional y técnica de todos los procesos en los que participé.</li>
            `,

    "bigdata4all-dates": "NOV 2017 — DIC 2018 · INTERLOMAS, EDO. MÉX.",
    "bigdata4all-bullets": `
              <li>Migré procesos de SQL a PySpark para mejorar la eficiencia y escalabilidad.</li>
              <li>Automaticé pipelines de ETL usando servicios de AWS.</li>
              <li>Redacté documentación funcional y técnica de todos los procesos en los que participé.</li>
            `,

    "projects-heading": "Proyectos personales",
    "project1-desc": "Este sitio — un portafolio personal construido desde cero con un motor de retrato ASCII interactivo, sin framework y sin paso de build.",
    "project2-desc": "Trabajo en progreso.",
    "project3-desc": "Trabajo en progreso.",

    "hobbies-heading": "Pasatiempos",

    "hobby-horse-title": "Equitación",
    "hobby-horse-desc": "Desde niña siempre quise ser amazona, pero no empecé a tomar clases de equitación hasta marzo de 2026 — desde entonces ha sido mi actividad favorita.",

    "hobby-reading-title": "Lectura",
    "hobby-reading-desc": 'Actualmente estoy leyendo <a href="https://www.amazon.com.mx/Mind-Gut-Connection-Conversation-Impacts-Choices/dp/0062376551/ref=sr_1_1?crid=7TGLIIBMNMPB&dib=eyJ2IjoiMSJ9.qzM8tKtAd5Ytuijvg_Pr-HQ3B3-2EKRTzSHOgPHqiKOkRihcgkY3CXRrSAfSc6PR_7fSUCzV0YKtaiHtW7WtOJNg8F_EnSyTbLtfX_Uk9BIMp3IilsD98x2j8d8fL8geUWp4i195fg-9uksp6JgGxTqSVib3v2AFy3icdtnSUDpi11eZWFAxdG0VlSTV1-dLSNiByrWMRk355HsF6ggKQmNPNdUHii6s2VZ7vjz9viEVZY_nzOJ86wzGrHW5uRzQnjnx2ogDMhDlc-c6RidEEq4gGaVblfT83P0Vxl73r0I.avl3-HIfdzg_FO0Div3hN3GMUz7uPEaK5b4rOS-9S4s&dib_tag=se&keywords=the+mind+gut+connection&qid=1787098640&sprefix=%2Caps%2C175&sr=8-1&ufe=app_do%3Aamzn1.fos.45030d3a-91a9-4303-890a-776dee9077c1" target="_blank" rel="noopener" class="inline-link">"The Mind-Gut Connection"</a> de Emeran Mayer, MD.',
    "hobby-buy-book": "Regálame un libro",

    "hobby-piano-title": "Piano",
    "hobby-piano-desc": 'De vez en cuando toco el piano. Actualmente estoy aprendiendo la técnica a través de un canal de YouTube llamado "Piano Roadmap".',

    "footer-built": "Creado por Lilian Muñoz.",
    "footer-rights": "Todos los derechos reservados. ©",
  },

  fr: {
    "nav-about": "À propos",
    "nav-experience": "Expérience",
    "nav-projects": "Projets personnels",
    "nav-hobbies": "Loisirs",

    "greeting": 'Coucou, <br> je suis <span class="accent">Lian</span>...',
    "subtext": `
        Ingénieure de Données qui construit l'infrastructure invisible qui rend les données fiables — des pipelines, pas des feuilles de calcul. <br>
        Native AWS, je parle couramment PySpark et j'écris du SQL comme une seconde langue. Dernièrement, j'intègre des outils d'IA à mon flux de travail — la même rigueur, avec une itération plus rapide.
      `,

    "about-heading": "À propos de moi",
    "about-body": `
        Je suis actuellement Ingénieure de Données chez
        <a href="https://www.wizeline.com/" target="_blank" rel="noopener" class="inline-link">Wizeline</a>,
        où je construis des pipelines et une infrastructure de données pour des clients comme Dow Jones et
        Kellogg's, sur PySpark et AWS. Auparavant, j'ai travaillé chez
        <a href="https://www.indragroup.com/es/america-latina/mexico" target="_blank" rel="noopener" class="inline-link">Indra</a>,
        <a href="https://www.xaldigital.com/" target="_blank" rel="noopener" class="inline-link">XalDigital</a> et
        <a href="https://www.gob.mx/ineel" target="_blank" rel="noopener" class="inline-link">INEEL</a>,
        où j'ai appris le métier en migrant des systèmes hérités vers des architectures modernes natives du cloud.
      `,
    "about-leisure": "Pendant mon temps libre, j'aime regarder des vidéos YouTube pour pratiquer et améliorer mon français, lire sur la santé intestinale et faire de l'équitation le week-end. Mon application préférée est Pinterest.",

    "experience-heading": "Expérience",

    "wizeline-role": "Ingénieure de Données Senior",
    "wizeline-dates": "OCT 2021 — AUJOURD'HUI · À DISTANCE",
    "wizeline-dowjones-bullets": `
                <li>Développé des rapports avec PySpark en appliquant la logique et les règles métier, en déployant les données finales dans des tables Athena pour la visualisation.</li>
                <li>Identifié, évalué et mis en œuvre des améliorations de processus, en analysant leur impact sur les résultats du projet.</li>
                <li>Migré des DAGs d'Airflow classique vers MWAA, améliorant l'efficacité et la performance.</li>
                <li>Fait la transition des processus d'EMR vers EMR Serverless, améliorant l'évolutivité et réduisant la charge opérationnelle et les temps de traitement.</li>
              `,
    "wizeline-kelloggs-bullets": `
                <li>Dirigé le projet d'optimisation et d'adaptation d'une application web pour surveiller et gérer les informations financières de ventes, auparavant stockées dans une feuille de calcul Excel.</li>
                <li>Assuré le rôle de principal point de contact avec le client, en coordonnant une équipe de designers et de développeurs et en traduisant des exigences complexes pour l'équipe.</li>
              `,
    "wizeline-academy-bullets": `
                <li>Conçu et créé le parcours d'apprentissage du Data Engineering Apprenticeship.</li>
                <li>Travaillé sur la modélisation des données et l'optimisation du projet final de l'Apprenticeship — utilisé par Wizeline pour évaluer les nouvelles recrues de l'équipe Data.</li>
              `,

    "de-role": "Ingénieure de Données",

    "indra-dates": "AVR 2021 — OCT 2021 · À DISTANCE",
    "indra-bullets": `
              <li>Migré un processus de Legacy vers la plateforme Datio pour construire un univers de données de contrats et clients en défaut de paiement.</li>
              <li>Élaboré des tests unitaires et d'acceptation.</li>
            `,

    "xaldigital-dates": "DÉC 2018 — DÉC 2020 · MEXICO",
    "xaldigital-bullets": `
              <li>Travaillé sur des projets dans les secteurs du commerce de détail et de l'assurance.</li>
              <li>Migré tout un processus de planification d'assortiment de fichiers Excel vers PySpark.</li>
              <li>Automatisé des pipelines ETL avec des services AWS.</li>
              <li>Migré des processus SQL vers PySpark pour améliorer l'efficacité et l'évolutivité.</li>
              <li>Dirigé le recueil des besoins et l'analyse métier pour proposer une architecture Data Lake sur AWS.</li>
              <li>Développé une preuve de concept pour générer des prévisions de demande de produits, architecturée sur AWS.</li>
              <li>Rédigé la documentation fonctionnelle et technique de tous les processus auxquels j'ai contribué.</li>
            `,

    "bigdata4all-dates": "NOV 2017 — DÉC 2018 · INTERLOMAS, ÉTAT DE MEXICO",
    "bigdata4all-bullets": `
              <li>Migré des processus SQL vers PySpark pour améliorer l'efficacité et l'évolutivité.</li>
              <li>Automatisé des pipelines ETL avec des services AWS.</li>
              <li>Rédigé la documentation fonctionnelle et technique de tous les processus auxquels j'ai contribué.</li>
            `,

    "projects-heading": "Projets personnels",
    "project1-desc": "Ce site — un portfolio personnel conçu de A à Z avec un moteur de portrait ASCII interactif, sans framework ni étape de build.",
    "project2-desc": "Travail en cours.",
    "project3-desc": "Travail en cours.",

    "hobbies-heading": "Loisirs",

    "hobby-horse-title": "Équitation",
    "hobby-horse-desc": "Depuis toute petite, j'ai toujours voulu être cavalière, mais je n'ai commencé les cours d'équitation qu'en mars 2026 — depuis, c'est devenu mon activité préférée.",

    "hobby-reading-title": "Lecture",
    "hobby-reading-desc": `Je lis actuellement <a href="https://www.amazon.com.mx/Mind-Gut-Connection-Conversation-Impacts-Choices/dp/0062376551/ref=sr_1_1?crid=7TGLIIBMNMPB&dib=eyJ2IjoiMSJ9.qzM8tKtAd5Ytuijvg_Pr-HQ3B3-2EKRTzSHOgPHqiKOkRihcgkY3CXRrSAfSc6PR_7fSUCzV0YKtaiHtW7WtOJNg8F_EnSyTbLtfX_Uk9BIMp3IilsD98x2j8d8fL8geUWp4i195fg-9uksp6JgGxTqSVib3v2AFy3icdtnSUDpi11eZWFAxdG0VlSTV1-dLSNiByrWMRk355HsF6ggKQmNPNdUHii6s2VZ7vjz9viEVZY_nzOJ86wzGrHW5uRzQnjnx2ogDMhDlc-c6RidEEq4gGaVblfT83P0Vxl73r0I.avl3-HIfdzg_FO0Div3hN3GMUz7uPEaK5b4rOS-9S4s&dib_tag=se&keywords=the+mind+gut+connection&qid=1787098640&sprefix=%2Caps%2C175&sr=8-1&ufe=app_do%3Aamzn1.fos.45030d3a-91a9-4303-890a-776dee9077c1" target="_blank" rel="noopener" class="inline-link">"The Mind-Gut Connection"</a> d'Emeran Mayer, MD.`,
    "hobby-buy-book": "Offrez-moi un livre",

    "hobby-piano-title": "Piano",
    "hobby-piano-desc": `De temps en temps, je joue du piano. J'apprends actuellement la technique via une chaîne YouTube appelée "Piano Roadmap".`,

    "footer-built": "Créé par Lilian Muñoz.",
    "footer-rights": "Tous droits réservés. ©",
  },
};
