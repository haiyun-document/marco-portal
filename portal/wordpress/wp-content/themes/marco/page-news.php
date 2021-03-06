<?php
/*
Template Name: News
*/
?>

<?php get_header(); ?>	
			<div id="content" class="row-fluid">
				<div id="main" class="span10 news" role="main">
						<div class="theme image">
								<img src="<?php echo  get_bloginfo('wpurl'); ?>/assets/img/carousel/dock.jpg"/>
							<div class="caption">
								News and Updates
							</div>
						</div>
						<div class="row-fluid">
							<div class="span12">
							</div>
						</div>
						<div class="row-fluid bugs">
						 <?php 
						  $categories = get_categories(); 
						  $index = 0;
						  foreach ($categories as $category) { 
						  	?>
							  <div class="span4">
							  <?php
							  $args = sprintf('category=%d&numberposts=1', $category->cat_ID);
							  $lastposts = get_posts($args);
							  foreach($lastposts as $post) : setup_postdata($post); ?>
							  	<div class="wrapper">
							  		<a href="<?php echo get_category_link( $category->cat_ID ); ?>">
								  		<div class="image">
											<?php echo the_post_thumbnail('medium'); ?>
								  			<h2><?php echo $category->cat_name; ?></h2>
								  		</div>
							  		</a>
							  		<h4><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h3>	
							  		<?php the_excerpt(); ?>
							 	</div>
							  </div>	
							  <?php endforeach; ?>
							  <?php
							$index++; } ?>			
					</div>
				</div> <!-- end #main -->
			    <?php get_sidebar(); // sidebar 1 ?>

			</div> <!-- end #content -->
<?php get_footer(); ?>