pub mod middleware;
pub mod response;
pub mod routes;

use actix_web::web;

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api/v1")
            .service(routes::auth::routes())
            .service(routes::files::routes())
            .service(routes::folders::routes())
            .service(routes::admin::routes()),
    )
    .service(routes::health::routes());
}
