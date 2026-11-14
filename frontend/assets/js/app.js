/** CineReview — punto de entrada; cada área vive en su módulo. */
import { header, footer, page } from './ui.js';

header();
footer();

const ROUTES = {
  home: ['./pages/catalog.js', 'home'],
  movies: ['./pages/catalog.js', 'moviesPage'],
  detail: ['./pages/catalog.js', 'detailPage'],
  login: ['./pages/accounts.js', 'authPages'],
  register: ['./pages/accounts.js', 'authPages'],
  recover: ['./pages/accounts.js', 'authPages'],
  'my-reviews': ['./pages/accounts.js', 'myReviewsPage'],
  reviews: ['./pages/community.js', 'reviewsPage'],
  contact: ['./pages/community.js', 'contactPage'],
  admin: ['./pages/community.js', 'adminPage'],
};

// Se usa importación por página para permitir integración gradual por ramas.
if (ROUTES[page]) {
  const [moduleURL, initializer] = ROUTES[page];
  import(moduleURL)
    .then(module => module[initializer]())
    .catch(error => {
      console.error('No se pudo abrir el módulo CineReview:', error);
      const container = document.querySelector('main');
      if (container) {
        container.insertAdjacentHTML('afterbegin',
          '<div class="container empty-state"><p>No se pudo cargar este módulo. Comprueba que estén integrados todos los archivos del equipo.</p></div>');
      }
    });
}
